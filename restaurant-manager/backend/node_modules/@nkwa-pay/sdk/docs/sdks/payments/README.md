# Payments
(*payments*)

## Overview

### Available Operations

* [get](#get) - Get the payment (collection or disbursement) with the specified ID.
* [collect](#collect) - Collect a payment from a phone number.
* [disburse](#disburse) - Disburse a payment from your balance to a phone number.

## get

Get the payment (collection or disbursement) with the specified ID.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="get_/payments/{id}" method="get" path="/payments/{id}" -->
```typescript
import { Pay } from "@nkwa-pay/sdk";

const pay = new Pay({
  apiKeyAuth: process.env["PAY_API_KEY_AUTH"] ?? "",
});

async function run() {
  const result = await pay.payments.get({
    id: "7112258c-4254-455f-a167-30549365ca9d",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { PayCore } from "@nkwa-pay/sdk/core.js";
import { paymentsGet } from "@nkwa-pay/sdk/funcs/paymentsGet.js";

// Use `PayCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const pay = new PayCore({
  apiKeyAuth: process.env["PAY_API_KEY_AUTH"] ?? "",
});

async function run() {
  const res = await paymentsGet(pay, {
    id: "7112258c-4254-455f-a167-30549365ca9d",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("paymentsGet failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.GetPaymentsIdRequest](../../models/operations/getpaymentsidrequest.md)                                                                                             | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.Payment](../../models/components/payment.md)\>**

### Errors

| Error Type       | Status Code      | Content Type     |
| ---------------- | ---------------- | ---------------- |
| errors.HttpError | 401, 404         | application/json |
| errors.HttpError | 500              | application/json |
| errors.APIError  | 4XX, 5XX         | \*/\*            |

## collect

Collect a payment from a phone number.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="post_/collect" method="post" path="/collect" -->
```typescript
import { Pay } from "@nkwa-pay/sdk";

const pay = new Pay({
  apiKeyAuth: process.env["PAY_API_KEY_AUTH"] ?? "",
});

async function run() {
  const result = await pay.payments.collect({
    amount: 291397,
    phoneNumber: "237650000000",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { PayCore } from "@nkwa-pay/sdk/core.js";
import { paymentsCollect } from "@nkwa-pay/sdk/funcs/paymentsCollect.js";

// Use `PayCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const pay = new PayCore({
  apiKeyAuth: process.env["PAY_API_KEY_AUTH"] ?? "",
});

async function run() {
  const res = await paymentsCollect(pay, {
    amount: 291397,
    phoneNumber: "237650000000",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("paymentsCollect failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [components.PaymentRequest](../../models/components/paymentrequest.md)                                                                                                         | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.Payment](../../models/components/payment.md)\>**

### Errors

| Error Type       | Status Code      | Content Type     |
| ---------------- | ---------------- | ---------------- |
| errors.HttpError | 400, 401, 403    | application/json |
| errors.HttpError | 500              | application/json |
| errors.APIError  | 4XX, 5XX         | \*/\*            |

## disburse

Disburse a payment from your balance to a phone number.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="post_/disburse" method="post" path="/disburse" -->
```typescript
import { Pay } from "@nkwa-pay/sdk";

const pay = new Pay({
  apiKeyAuth: process.env["PAY_API_KEY_AUTH"] ?? "",
});

async function run() {
  const result = await pay.payments.disburse({
    amount: 717423,
    phoneNumber: "237650000000",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { PayCore } from "@nkwa-pay/sdk/core.js";
import { paymentsDisburse } from "@nkwa-pay/sdk/funcs/paymentsDisburse.js";

// Use `PayCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const pay = new PayCore({
  apiKeyAuth: process.env["PAY_API_KEY_AUTH"] ?? "",
});

async function run() {
  const res = await paymentsDisburse(pay, {
    amount: 717423,
    phoneNumber: "237650000000",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("paymentsDisburse failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [components.PaymentRequest](../../models/components/paymentrequest.md)                                                                                                         | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.Payment](../../models/components/payment.md)\>**

### Errors

| Error Type       | Status Code      | Content Type     |
| ---------------- | ---------------- | ---------------- |
| errors.HttpError | 400, 401, 403    | application/json |
| errors.HttpError | 500              | application/json |
| errors.APIError  | 4XX, 5XX         | \*/\*            |