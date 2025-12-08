# Availability
(*availability*)

## Overview

### Available Operations

* [check](#check) - Check which operators and operations are currently available.

## check

Check which operators and operations are currently available.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="get_/availability" method="get" path="/availability" -->
```typescript
import { Pay } from "@nkwa-pay/sdk";

const pay = new Pay({
  apiKeyAuth: process.env["PAY_API_KEY_AUTH"] ?? "",
});

async function run() {
  const result = await pay.availability.check();

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { PayCore } from "@nkwa-pay/sdk/core.js";
import { availabilityCheck } from "@nkwa-pay/sdk/funcs/availabilityCheck.js";

// Use `PayCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const pay = new PayCore({
  apiKeyAuth: process.env["PAY_API_KEY_AUTH"] ?? "",
});

async function run() {
  const res = await availabilityCheck(pay);
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("availabilityCheck failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.Availability[]](../../models/.md)\>**

### Errors

| Error Type       | Status Code      | Content Type     |
| ---------------- | ---------------- | ---------------- |
| errors.HttpError | 401              | application/json |
| errors.HttpError | 500              | application/json |
| errors.APIError  | 4XX, 5XX         | \*/\*            |