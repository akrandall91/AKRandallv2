function doPost(e) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const formType = String(e.parameter.formType || "").toLowerCase();
  const tabs = {
    contact: "Contact",
    newsletter: "Newsletter"
  };
  const tabName = tabs[formType];

  if (!tabName) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: "Unknown form type" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = spreadsheet.getSheetByName(tabName);
  if (!sheet) {
    throw new Error("Missing sheet tab: " + tabName);
  }

  if (formType === "contact") {
    sheet.appendRow([
      new Date(),
      e.parameter.name || "",
      e.parameter.email || "",
      e.parameter.type || "",
      e.parameter.message || ""
    ]);
  } else {
    sheet.appendRow([
      new Date(),
      e.parameter.email || ""
    ]);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
