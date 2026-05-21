# Raw media input

Place media ZIP archives or extracted media files here.

Supported:

1. ZIP archives with nested files
2. direct image files
3. direct video files
4. optional `aliases.json` for renamed or superseded source filenames

The pipeline scans recursively.

Alias file format:

1. key: filename as referenced by XLSX
2. value: actual filename present in source media

Example:

```json
{
  "5-9.2021.wmv": "5-9.2021 bis.wmv"
}
```
