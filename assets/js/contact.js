document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("[data-contact-form]");
  const frame = document.querySelector("[data-contact-frame]");
  const status = document.querySelector("[data-form-status]");
  if (!form || !frame || !status) return;

  let submitted = false;
  form.addEventListener("submit", (event) => {
    if (form.action.includes("REPLACE_WITH_APPS_SCRIPT_EXEC_URL")) {
      event.preventDefault();
      status.textContent = "Form delivery needs the Google Apps Script /exec URL. For now, email andrew@akrandall.com.";
      status.hidden = false;
      return;
    }
    submitted = true;
    status.hidden = true;
  });

  frame.addEventListener("load", () => {
    if (!submitted) return;
    submitted = false;
    form.reset();
    status.hidden = false;
  });
});
