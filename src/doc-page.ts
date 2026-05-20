// Static HTML page that renders the OpenAPI spec via Scalar (CDN).
// No build step, no dependencies in the worker bundle.

export function apiDocHtml(baseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DingTalk Notify · API Docs</title>
  <link rel="alternate" type="application/json" href="${baseUrl}/openapi.json" />
</head>
<body>
  <script
    id="api-reference"
    data-url="${baseUrl}/openapi.json"
    data-configuration='{"theme":"deepSpace","layout":"modern","hideDownloadButton":false}'
  ></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
}
