# Translation overlays

Optional overlay files can be placed here to enrich the official dataset.

Supported filenames:

1. `questions.ua.json`
2. `questions.en.json`
3. `questions.pl.json`
4. `explanations.ua.json`
5. `explanations.en.json`
6. `explanations.pl.json`

Expected format:

```json
[
  {
    "questionSourceId": "12345",
    "value": "Translated or generated text"
  }
]
```
