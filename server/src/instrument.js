import * as Sentry from "@sentry/node";
// Ensure to call this before importing any other modules!
Sentry.init({
  dsn: "https://d04dc9e64c3fc6ba0227a878441357dc@o466449.ingest.us.sentry.io/4507420521922560",
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
