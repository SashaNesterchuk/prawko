"""Read-only RevenueCat customer event source; exact client transaction country joins."""
import datetime as dt
from decimal import Decimal, ROUND_HALF_UP
import json
from pathlib import Path
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

APP_IDS={'appde3a024d60','appc0cc05e8b1'}
CHARGES={'PURCHASES_INITIAL_PURCHASE','PURCHASES_RENEWAL','PURCHASES_NON_RENEWING_PURCHASE'}

class Client:
    def __init__(self,env):
        project=env['PRAWKO_REVENUECAT_PROJECT_ID']
        if not project.startswith('proj') or not project.isalnum():raise ValueError('Invalid RevenueCat project ID')
        self.base='https://api.revenuecat.com/v2/projects/'+project+'/'
        self.key=env['PRAWKO_REVENUECAT_API_KEY']
        self.lock=threading.Lock();self.next_request=0
    def get(self,path):
        url=urllib.parse.urljoin(self.base,path)
        if not url.startswith(self.base):raise ValueError('Unsafe provider pagination URL')
        for attempt in range(3):
            with self.lock:
                delay=max(0,self.next_request-time.monotonic())
                self.next_request=max(self.next_request,time.monotonic())+.18
            if delay:time.sleep(delay)
            request=urllib.request.Request(url,headers={'Authorization':'Bearer '+self.key})
            try:
                with urllib.request.urlopen(request,timeout=45) as response:return json.load(response,parse_float=Decimal)
            except urllib.error.HTTPError as error:
                if error.code==429 and attempt<2:
                    time.sleep(min(30,max(1,int(error.headers.get('Retry-After','5')))));continue
                raise RuntimeError(f'RevenueCat HTTP {error.code}; read failed') from None
        raise RuntimeError('RevenueCat retry limit')
    def items(self,path):
        result=[];seen_pages=set()
        for _ in range(1000):
            if path in seen_pages:raise RuntimeError('RevenueCat pagination loop')
            seen_pages.add(path);data=self.get(path)
            if data.get('object')!='list' or not isinstance(data.get('items'),list):raise ValueError('Invalid RevenueCat list')
            result.extend(data['items']);path=data.get('next_page')
            if not path:return result
        raise RuntimeError('RevenueCat page limit reached')

def export_events(env,output):
    client=Client(env)
    customers=client.items('customers?limit=100')
    def fetch(customer):
        return client.items('customers/'+urllib.parse.quote(customer['id'],safe='')+'/events?environment=production&limit=100')
    events=[]
    with ThreadPoolExecutor(max_workers=6) as pool:
        for rows in pool.map(fetch,customers):events.extend(rows)
    dedup={}
    for event in events:
        key=event['id']
        if key in dedup and dedup[key]!=event:raise ValueError('Conflicting RevenueCat event ID')
        dedup[key]=event
    result={'source':'RevenueCat API v2 authenticated GET','as_of':dt.datetime.now(dt.timezone.utc).isoformat(),'customers':len(customers),'pagination_complete':True,'events':list(dedup.values())}
    output.parent.mkdir(parents=True,exist_ok=True)
    temporary=output.with_suffix('.tmp');temporary.write_text(json.dumps(result,default=str));temporary.chmod(0o600);temporary.replace(output)
    return result

def country_index(rows):
    # Provider transaction + original lineage are matched only with explicit same app_user_id.
    index={}
    for app_user,transaction,country in rows:
        if not app_user or not transaction:continue
        index.setdefault((str(app_user),str(transaction)),set()).add(country if country in ('PL','CZ','SK') else 'UNKNOWN')
    return index

def event_country(event,index):
    body=event['body'];candidates=set()
    ids={body.get('app_user_id'),body.get('original_app_user_id')}- {None,''}
    # Renewals retain the country of the exact original transaction if observed.
    for identity in ids:
        for transaction in {body.get('transaction_id'),body.get('original_transaction_id')}-{None,''}:
            candidates.update(index.get((str(identity),str(transaction)),set()))
    return next(iter(candidates)) if len(candidates)==1 else 'UNKNOWN'

def revenue_snapshot(archive,index,day,start,end):
    totals={c:Decimal('0') for c in ('PL','CZ','SK','UNKNOWN')}
    charges=0;unknown=0;unsupported=[]
    seen={}
    for event in archive['events']:
        body=event.get('body',{})
        if event.get('app_id') not in APP_IDS or body.get('environment')!='PRODUCTION':continue
        moment=dt.datetime.fromtimestamp(event['occurred_at']/1000,dt.timezone.utc)
        kind=event.get('type')
        if kind in CHARGES:
            moment=dt.datetime.fromtimestamp(body['purchased_at_ms']/1000,dt.timezone.utc)
            if not start<=moment<end:continue
            money=Decimal(str(body.get('price')))
            if not money.is_finite() or money<0:raise ValueError('Invalid RevenueCat gross charge')
            if money==0:continue  # trials are not revenue
            key=(event['app_id'],body['store'],body['transaction_id'])
            signature=(str(money),body['purchased_at_ms'],body.get('product_id'))
            if key in seen:
                if seen[key]!=signature:raise ValueError('Conflicting source transaction')
                continue
            seen[key]=signature;country=event_country(event,index)
            totals[country]+=money.quantize(Decimal('.01'),rounding=ROUND_HALF_UP)
            charges+=1;unknown+=int(country=='UNKNOWN')
        elif start<=moment<end and (kind=='PURCHASES_CANCELLATION' and body.get('cancel_reason')=='CUSTOMER_SUPPORT' or kind and ('REFUND' in kind or 'ADJUST' in kind)):
            raw=body.get('price')
            if raw is None:unsupported.append(kind);continue
            money=Decimal(str(raw))
            if not money.is_finite() or (kind=='PURCHASES_CANCELLATION' and money>=0) or ('REFUND_REVERSED' in kind and money<0):
                unsupported.append(kind);continue
            totals[event_country(event,index)]+=money.quantize(Decimal('.01'),rounding=ROUND_HALF_UP)
    if unsupported:raise ValueError('Refund/adjustment observed; financial reconciliation required before daily amount')
    return {'day':str(day),'timezone':'Europe/Warsaw','source':'RevenueCat','country_basis':'exam_country','complete':True,'as_of':archive['as_of'],'countries':{c:{'USD':format(v,'.2f')} for c,v in totals.items()},'positive_transactions':charges,'unattributed_transactions':unknown,'attribution_basis':'exact app_user_id + transaction_id/original_transaction_id; otherwise UNKNOWN','money_basis':'source gross charges and signed refund adjustments in USD, rounded per event; unsupported adjustments refused','customer_pages_complete':True,'customer_count':archive['customers']}

def transaction_country_query():
    return """SELECT properties.app_user_id, properties.transaction_id, properties.exam_country
    FROM events WHERE properties.$app_namespace = 'com.mindjar.prawko'
    AND (properties.analytics_environment IS NULL OR properties.analytics_environment = 'production_candidate')
    AND event = 'purchase_succeeded'
    AND (properties.analytics_payload_valid IS NULL OR properties.analytics_payload_valid = true)
    AND properties.app_user_id IS NOT NULL
    AND properties.transaction_id IS NOT NULL
    GROUP BY properties.app_user_id, properties.transaction_id, properties.exam_country LIMIT 100000"""
