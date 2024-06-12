import * as Sentry from "@sentry/node";
// Ensure to call this before importing any other modules!
Sentry.init({
  dsn: "https://2f3707817f9746988922c71086a9765c@o466449.ingest.us.sentry.io/5480776",
});

Sentry.startSpan(
  {
    op: "test",
    name: "My First Test Transaction",
  },
  () => {
    setTimeout(() => {
      try {
        foo();
      } catch (e) {
        Sentry.captureException(e);
      }
    }, 99);
  },
);
