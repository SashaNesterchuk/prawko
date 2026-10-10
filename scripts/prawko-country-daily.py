#!/usr/bin/env python3
"""Separate PL/CZ/SK daily report. Read-only API; no client money estimates."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.request
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
ACTIVITY = ('Application Opened', 'screen_viewed', 'screen_visit_started', 'training_question_answered', 'exam_question_answered', 'sign_test_question_answered', 'purchase_started', 'purchase_succeeded')
COUNTRIES = ('PL', 'CZ', 'SK', 'UNKNOWN')

def query_api(env, query):
    host = env['PRAWKO_POSTHOG_HOST'].rstrip('/')
    project = env['PRAWKO_POSTHOG_PROJECT_ID']
    if not host.startswith('https://') or not project.isdigit():
        raise ValueError('Invalid PostHog endpoint')
    request = urllib.request.Request(f'{host}/api/projects/{project}/query/', data=json.dumps({'query':{'kind':'HogQLQuery','query':query},'refresh':'force_blocking'}).encode(), headers={'Authorization':'Bearer '+env['PRAWKO_POSTHOG_API_KEY'],'Content-Type':'application/json'})
    with urllib.request.urlopen(request, timeout=90) as response:
        payload = json.load(response)
    rows = payload.get('results', payload.get('responseData',{}).get('results'))
    if rows is None or payload.get('error') or payload.get('is_cached') or payload.get('hasMore') or len(rows)>=100000:
        raise RuntimeError('Incomplete or cached PostHog query; report refused')
    return rows

def aggregate(rows, start, end):
    result = {c:{'new_users':0,'active_users':0,'sessions':0,'revenue':None} for c in COUNTRIES}
    seen = set()
    all_sessions = set()
    session_country = {}
    missing_sessions = 0
    for person, first_seen, country, sessions in rows:
        if not person or person == '00000000-0000-0000-0000-000000000000':
            raise ValueError('Missing canonical PostHog person identity')
        if person in seen:
            raise ValueError('Repeated person aggregate')
        seen.add(person)
        country = country if country in COUNTRIES else 'UNKNOWN'
        first = dt.datetime.fromisoformat(str(first_seen).replace('Z','+00:00'))
        if first.tzinfo is None: first=first.replace(tzinfo=dt.timezone.utc)
        result[country]['active_users'] += 1
        result[country]['new_users'] += int(start<=first<end)
        valid = {s for s in sessions if isinstance(s,str) and s.strip()}
        missing_sessions += int(not valid)
        for session in valid:
            if session in session_country and session_country[session] != (country, person):
                raise ValueError('Session shared across countries/persons; attribution ambiguous')
            session_country[session]=(country, person)
        all_sessions.update(valid)
    for country in COUNTRIES:
        result[country]['sessions']=sum(c==country for c, _person in session_country.values())
    return {'countries':result,'active_users_total':len(seen),'sessions_total':len(all_sessions),'users_without_session':missing_sessions}

def metric_query(start,end):
    begin=start.strftime('%Y-%m-%d %H:%M:%S'); stop=end.strftime('%Y-%m-%d %H:%M:%S')
    activity=', '.join("'"+name+"'" for name in ACTIVITY)
    scope="properties.$app_namespace = 'com.mindjar.prawko' AND (properties.analytics_environment IS NULL OR properties.analytics_environment = 'production_candidate')"
    day=f"timestamp >= toDateTime('{begin}', 'UTC') AND timestamp < toDateTime('{stop}', 'UTC') AND event IN ({activity})"
    return f"""SELECT toString(person_id), min(timestamp),
        argMaxIf(properties.exam_country, timestamp, {day} AND properties.exam_country IN ('PL','CZ','SK')),
        groupUniqArrayIf(properties.$session_id, {day} AND properties.$session_id IS NOT NULL)
        FROM events WHERE {scope} AND timestamp < toDateTime('{stop}', 'UTC')
        GROUP BY person_id HAVING countIf({day}) > 0 LIMIT 100000"""

def apply_revenue(summary, path, day):
    # Optional reviewed snapshot. Country MUST be exam country, never IP/store country.
    if not path: return {'status':'not_connected','reason':'RevenueCat exam-country source not connected'}
    data=json.loads(path.read_text())
    if data.get('day') != str(day) or data.get('timezone')!='Europe/Warsaw' or data.get('country_basis')!='exam_country' or data.get('source')!='RevenueCat' or data.get('complete') is not True:
        raise ValueError('Wrong day, scope or incomplete revenue source')
    from decimal import Decimal
    rows=data.get('countries',{})
    if set(rows)!=set(COUNTRIES): raise ValueError('Revenue snapshot must include all countries and UNKNOWN')
    for country, currencies in rows.items():
        if not isinstance(currencies,dict): raise ValueError('Currency amounts required')
        for currency, amount in currencies.items():
            if len(currency)!=3 or not currency.isupper() or not Decimal(str(amount)).is_finite(): raise ValueError('Invalid money')
        summary['countries'][country]['revenue']=currencies
    return {'status':'reviewed_snapshot','as_of':data.get('as_of'),'basis':'RevenueCat source gross; currencies separate'}

def render(summary, day):
    labels={'PL':'Польща','CZ':'Чехія','SK':'Словаччина','UNKNOWN':'Країна невідома'}
    lines=[f'Prawko · показники за {day:%d.%m.%Y}', 'Часовий пояс: Варшава', '']
    for country in COUNTRIES:
        row=summary['countries'][country]
        if country=='UNKNOWN' and not row['active_users'] and not row.get('revenue'): continue
        money=row['revenue']
        text='дані не підключено' if money is None else (', '.join(f'{v} {k}' for k,v in sorted(money.items())) or '0 (перевірено джерелом)')
        lines.extend([labels[country],f"• Нові користувачі: {row['new_users']}",f"• Активні користувачі: {row['active_users']}",f"• Сесії: {row['sessions']}",f'• Виручка до комісій: {text}',''])
    lines.extend(['Нові = вперше помічені в доступній історії PostHog; активні = були дії в застосунку за день. Країна — остання відома країна іспиту серед дій цього дня.', 'Показники попередні: пізні події можуть змінити числа.'])
    if summary['users_without_session']: lines.append(f"Без ID сесії: {summary['users_without_session']} активних користувачів.")
    return '\n'.join(lines)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--day',type=dt.date.fromisoformat,default=dt.datetime.now(ZoneInfo('Europe/Warsaw')).date()-dt.timedelta(days=1))
    parser.add_argument('--env-file',type=Path,required=True)
    parser.add_argument('--revenue-file',type=Path)
    parser.add_argument('--revenue-env-file',type=Path,default=ROOT/'.env.local')
    parser.add_argument('--reuse-revenue',action='store_true',help='Manual validation only: reuse the authenticated API archive')
    parser.add_argument('--reuse-engine',action='store_true',help='Reuse already verified dump and engine reports for this day')
    args=parser.parse_args()
    env=dict(os.environ)
    for line in args.env_file.read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k,v=line.split('=',1);env.setdefault(k.strip(),v.strip().strip('\"\''))
    if args.revenue_env_file.is_file():
        for line in args.revenue_env_file.read_text().splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                k,v=line.split('=',1)
                if v.strip():env.setdefault(k.strip(),v.strip().strip('\"\''))
    output=ROOT/'analytics-engine'/'warehouse'/'daily'/str(args.day)
    if not args.reuse_engine:
        subprocess.run([sys.executable,str(ROOT/'scripts/prawko-daily-analytics.py'),'--day',str(args.day),'--env-file',str(args.env_file)],check=True)
    for name in ('posthog','context','data-quality','paywall-observations'):
        if not (output/(name+'.json')).is_file(): raise RuntimeError('Engine input/report missing')
    start=dt.datetime.combine(args.day,dt.time(),ZoneInfo('Europe/Warsaw')).astimezone(dt.timezone.utc)
    end=dt.datetime.combine(args.day+dt.timedelta(days=1),dt.time(),ZoneInfo('Europe/Warsaw')).astimezone(dt.timezone.utc)
    rows=query_api(env,metric_query(start,end))
    summary=aggregate(rows,start,end)
    revenue_file=args.revenue_file
    revenue_error=None
    snapshot=None
    if not revenue_file and env.get('PRAWKO_REVENUECAT_API_KEY'):
        from prawko_daily_revenue import export_events, country_index, revenue_snapshot, transaction_country_query
        try:
            archive_path=output/'revenuecat-api.json'
            archive=json.loads(archive_path.read_text()) if args.reuse_revenue else export_events(env,archive_path)
            index=country_index(query_api(env,transaction_country_query()))
            snapshot=revenue_snapshot(archive,index,args.day,start,end)
            revenue_file=output/'revenuecat-country.json'
            revenue_file.write_text(json.dumps(snapshot,ensure_ascii=False,indent=2)+'\n')
        except Exception as error:
            # Source failures never become zero and do not suppress product counts.
            revenue_error=type(error).__name__+': '+str(error)
    financial=apply_revenue(summary,revenue_file,args.day)
    if revenue_error:financial={'status':'unavailable','reason':revenue_error}
    elif snapshot:financial.update({'status':'api_connected','positive_transactions':snapshot['positive_transactions'],'unattributed_transactions':snapshot['unattributed_transactions'],'customer_count':snapshot['customer_count'],'attribution_basis':snapshot['attribution_basis'],'money_basis':snapshot['money_basis']})

    summary.update({'day':str(args.day),'timezone':'Europe/Warsaw','source':'PostHog query API','exported_at':dt.datetime.now(dt.timezone.utc).isoformat(),'user_grain':'PostHog person_id; not unique humans','country_basis':'last known exam_country on active event in day','session_basis':'unique SDK $session_id with activity in day, assigned to user day country','first_seen_basis':'earliest retained mobile event for canonical person_id; not install time','revenue_source':financial,'engine_reports':['context.json','data-quality.json','paywall-observations.json']})
    (output/'country-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    (output/'country-report.txt').write_text(render(summary,args.day)+'\n')
    print(json.dumps(summary,ensure_ascii=False))

if __name__=='__main__': main()
