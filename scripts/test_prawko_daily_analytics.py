import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('daily', Path(__file__).with_name('prawko-daily-analytics.py'))
daily = importlib.util.module_from_spec(spec)
spec.loader.exec_module(daily)

class Response:
    def __init__(self, body): self.body = body
    def __enter__(self):
        import io
        return io.BytesIO(json.dumps(self.body).encode())
    def __exit__(self, *args): pass

class ExportTests(unittest.TestCase):
    def run_export(self, body, root):
        with patch.object(daily, 'ROOT', Path(root)), patch.dict(daily.os.environ, {'PRAWKO_POSTHOG_HOST':'https://example.test','PRAWKO_POSTHOG_PROJECT_ID':'1','PRAWKO_POSTHOG_API_KEY':'test'}), patch('sys.argv',['daily','--day','2026-10-08']), patch.object(daily.urllib.request,'urlopen',return_value=Response(body)), patch.object(daily.subprocess,'run') as run:
            daily.main()
            return run.call_count
    def test_source_duplicates_retained_without_invented_watermark(self):
        row=['abc','test','2026-10-08T12:00:00Z','anonymous',{}]
        with tempfile.TemporaryDirectory() as root:
            self.assertEqual(self.run_export({'results':[row,row]},root),4)
            data=json.loads((Path(root)/'analytics-engine/warehouse/daily/2026-10-08/posthog.json').read_text())
            self.assertEqual(len(data['events']),2)
            self.assertNotIn('delivery_watermark',data['coverage'])
            self.assertEqual(data['from'],'2026-10-05T22:00:00+00:00')
    def test_truncation_refused_before_engine(self):
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(RuntimeError): self.run_export({'results':[],'hasMore':True},root)
            self.assertFalse((Path(root)/'analytics-engine').exists())
    def test_cached_data_refused(self):
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(RuntimeError): self.run_export({'results':[],'is_cached':True},root)
    def test_missing_results_not_empty_success(self):
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(RuntimeError): self.run_export({},root)

if __name__=='__main__': unittest.main()
