import datetime as dt
import unittest
from prawko_daily_revenue import country_index,event_country,revenue_snapshot,Client
START=dt.datetime(2026,10,7,22,tzinfo=dt.timezone.utc)
END=dt.datetime(2026,10,8,22,tzinfo=dt.timezone.utc)
DAY=dt.date(2026,10,8)
def event(identifier='e',transaction='t',price='6.397',moment=START,kind='PURCHASES_NON_RENEWING_PURCHASE'):
 return {'id':identifier,'app_id':'appde3a024d60','type':kind,'occurred_at':int(moment.timestamp()*1000),'body':{'environment':'PRODUCTION','app_user_id':'u','original_app_user_id':'u','transaction_id':transaction,'original_transaction_id':transaction,'purchased_at_ms':int(moment.timestamp()*1000),'price':price,'store':'APP_STORE','product_id':'premium'}}
def snap(events,index=None):return revenue_snapshot({'events':events,'as_of':END.isoformat(),'customers':1},index or {},DAY,START,END)
class MoneyTests(unittest.TestCase):
 def test_exact_join_and_usd_rounding(self):
  d=snap([event()],country_index([['u','t','PL']]))
  self.assertEqual(d['countries']['PL'],{'USD':'6.40'})
 def test_matching_transaction_on_wrong_user_not_joined(self):
  d=snap([event()],country_index([['other','t','CZ']]))
  self.assertEqual(d['countries']['UNKNOWN'],{'USD':'6.40'})
 def test_conflicting_countries_unknown(self):
  self.assertEqual(event_country(event(),country_index([['u','t','PL'],['u','t','CZ']])),'UNKNOWN')
 def test_trial_sandbox_and_test_store_not_revenue(self):
  trial=event(price='0');sandbox=event(identifier='s');sandbox['body']['environment']='SANDBOX'
  test=event(identifier='test');test['app_id']='appa388111577'
  d=snap([trial,sandbox,test]);self.assertEqual(d['positive_transactions'],0)
 def test_duplicate_transactions_not_double_counted(self):
  self.assertEqual(snap([event(),event(identifier='alias')])['positive_transactions'],1)
 def test_conflicting_amounts_refused(self):
  with self.assertRaises(ValueError):snap([event(),event(identifier='other',price='7')])
 def test_warsaw_day_boundary(self):
  self.assertEqual(snap([event(moment=START),event(identifier='out',transaction='out',moment=END)])['positive_transactions'],1)
 def test_signed_refund_uses_event_time(self):
  refund=event(price='-6.397',kind='PURCHASES_CANCELLATION');refund['body']['cancel_reason']='CUSTOMER_SUPPORT';refund['body']['purchased_at_ms']=0
  self.assertEqual(snap([refund])['countries']['UNKNOWN'],{'USD':'-6.40'})
 def test_unquantified_refund_refused(self):
  refund=event(price=None,kind='PURCHASES_CANCELLATION');refund['body']['cancel_reason']='CUSTOMER_SUPPORT'
  with self.assertRaises(ValueError):snap([refund])
 def test_unsafe_pagination_refused_before_auth_transmission(self):
  c=Client({'PRAWKO_REVENUECAT_PROJECT_ID':'projtest','PRAWKO_REVENUECAT_API_KEY':'test'})
  with self.assertRaises(ValueError):c.get('https://other.test/v2/next')
if __name__=='__main__':unittest.main()
