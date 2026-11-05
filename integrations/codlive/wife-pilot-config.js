// Conditional ZIP-form pilot configuration. NOT a patch for the current live advertorial.
// The authorized developer must replace this with the actual deployed CRM HTTPS origin.
(function () {
  const CRM_BASE = 'https://CRM-ENDPOINT.invalid';
  let submit;
  window.submitCodLivePilotOrder = function (payload, sheetSubmit) {
    try {
      const url = new URL(CRM_BASE);
      if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
          url.hostname.endsWith('.invalid') || url.hostname === 'localhost' || url.hostname.endsWith('.localhost') ||
          url.hostname === '127.0.0.1' || url.hostname === '[::1]') {
        throw Error('Configure the authorized public HTTPS CRM origin before enabling this pilot.');
      }
      submit ??= window.createCodLiveCRM({base:url.origin,formId:'codlive_wife_pilot_v1',version:'codlive-v1'});
      return submit(payload,sheetSubmit);
    } catch (error) {
      return Promise.reject(error);
    }
  };
})();
