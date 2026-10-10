#!/usr/bin/env python3
"""Read-only PostHog export and deterministic daily reports. No money inferred."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import urllib.request
import urllib.error
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--day', type=dt.date.fromisoformat, default=dt.datetime.now(ZoneInfo('Europe/Warsaw')).date()-dt.timedelta(days=1))
    parser.add_argument('--env-file', type=Path)
    args = parser.parse_args()
    env = dict(os.environ)
    if args.env_file:
        for line in args.env_file.read_text().splitlines():
            if line.strip() and not line.lstrip().startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                env.setdefault(k.strip(), v.strip().strip('\"\''))
    host = env['PRAWKO_POSTHOG_HOST'].rstrip('/')
    if not host.startswith('https://'):
        raise ValueError('HTTPS required')
    project = env['PRAWKO_POSTHOG_PROJECT_ID']
    if not project.isdigit():
        raise ValueError('Numeric project ID required')
    start = dt.datetime.combine(args.day-dt.timedelta(days=2), dt.time(), ZoneInfo('Europe/Warsaw')).astimezone(dt.timezone.utc)
    end = dt.datetime.combine(args.day+dt.timedelta(days=1), dt.time(), ZoneInfo('Europe/Warsaw')).astimezone(dt.timezone.utc)
    events = []
    query = f"SELECT toString(uuid), event, timestamp, distinct_id, properties FROM events WHERE timestamp >= toDateTime('{start.strftime('%Y-%m-%d %H:%M:%S')}', 'UTC') AND timestamp < toDateTime('{end.strftime('%Y-%m-%d %H:%M:%S')}', 'UTC') ORDER BY timestamp, uuid LIMIT 100000"
    req = urllib.request.Request(f'{host}/api/projects/{project}/query/', data=json.dumps({'query': {'kind':'HogQLQuery','query':query}, 'refresh':'force_blocking'}).encode(), headers={'Authorization': 'Bearer '+env['PRAWKO_POSTHOG_API_KEY'], 'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            body = json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'PostHog HTTP {error.code}; export failed') from None
    rows = body.get('results', body.get('responseData', {}).get('results'))
    if rows is None or body.get('error') or body.get('is_cached'):
        raise RuntimeError('Missing results, failed query or cached export; refusing to publish')
    if body.get('hasMore') is True or len(rows) >= 100000:
        raise RuntimeError('Window exceeds safe single-page size; use batch exports')
    # Preserve source duplicates/conflicting payloads; engine owns deduplication.
    for uuid, event, timestamp, distinct_id, properties in rows:
        if isinstance(properties, str):
            properties = json.loads(properties)
        events.append({'uuid':uuid,'event':event,'timestamp':timestamp,'distinct_id':distinct_id,'properties':properties})
    output = ROOT/'analytics-engine'/'warehouse'/'daily'/args.day.isoformat()
    output.mkdir(parents=True, exist_ok=True)
    dump = output/'posthog.json'
    payload = {'exportedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'from':start.isoformat(),'to':end.isoformat(),'timezone':'Europe/Warsaw','source':'PostHog query API','events':events,'coverage':{'pagination_complete':True,'truncated':False,'window_start':start.isoformat(),'window_end':end.isoformat()}}
    # No receipt watermark/application scope is invented. Engine restricts rates.
    temporary = dump.with_suffix('.tmp')
    temporary.write_text(json.dumps(payload))
    temporary.replace(dump)
    engine = ROOT/'analytics-engine'/'.venv'/'bin'/'prawko-analytics'
    child_env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
    warehouse = ROOT/'analytics-engine'/'warehouse'/'daily-events'
    subprocess.run([str(engine),'ingest',str(dump),'--warehouse',str(warehouse)],check=True,env=child_env,stdout=subprocess.DEVNULL)
    for report in ('context','data-quality','paywall-observations'):
        subprocess.run([str(engine),report,'--day',args.day.isoformat(),'--warehouse',str(warehouse),'--out',str(output/(report+'.json'))],check=True,env=child_env,stdout=subprocess.DEVNULL)
    print(json.dumps({'day':str(args.day),'observed_events_3_days':len(events),'reports':str(output),'rates':'restricted: no verified delivery watermark'}))

if __name__ == '__main__':
    main()
