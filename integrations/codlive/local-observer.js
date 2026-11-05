// Local-only diagnostics and acknowledgment observation. Never initiates an order.
(() => {
  const config = document.currentScript.dataset;
  const crm = config.crmBase, formId = config.formId;
  const native = window.fetch.bind(window);
  const form = document.getElementById('orderForm');
  const notice = document.createElement('p');
  notice.id = 'local-submit-status'; notice.setAttribute('role', 'status');
  notice.style.cssText = 'padding:12px;background:#fff3cd;color:#222;white-space:normal';
  form.append(notice);
  const names = {fullName:'Full name',phone:'10-digit mobile',address:'Address',landmark:'Landmark',state:'State',pincode:'6-digit pincode',city:'City',course:'Course'};
  function report(stage, message, extra = {}) {
    notice.textContent = message;
    void native('/local-diagnostics', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stage,...extra})}).catch(() => {});
  }
  notice.textContent = 'Connected to main CRM localhost:3000. No order has been submitted from this page yet.';
  form.addEventListener('submit', () => {
    const invalid = Array.from(form.elements).filter(e => e.willValidate && !e.validity.valid).map(e => e.id);
    if (!document.querySelector('input[name="course"]:checked') && !document.getElementById('formCourse').value) invalid.push('course');
    if (!/^[6-9]\d{9}$/.test(document.getElementById('phone').value.replace(/\D/g,'')) && !invalid.includes('phone')) invalid.push('phone');
    if (invalid.length) report('validation_blocked','Not sent. Complete or correct: '+invalid.map(k=>names[k]||'Required field').join(', ')+'.',{invalid_fields:invalid});
    else report('submit_started','Submitting your order. Waiting for main CRM and local mock Sheet acknowledgments.');
  }, true);
  window.addEventListener('error', () => report('javascript_error','Form JavaScript error. Keep this tab open and report this message.'));
  window.fetch = async (input, options = {}) => {
    const url = new URL(String(input),location.href);
    const sheet = url.origin === location.origin && url.pathname === '/mock-sheet';
    const challenge = url.origin === crm && url.pathname === '/api/public/lead-challenge';
    const lead = url.origin === crm && url.pathname === '/api/public/leads';
    let init = options;
    if (sheet) {
      const pending = JSON.parse(sessionStorage.getItem('crm-codlive:'+formId)||'null');
      init = {...options,headers:{...options.headers,'X-Local-Submission-ID':pending?.inquiry?.submission_id||''}};
    }
    let response;
    try { response = await native(input,init); }
    catch (e) {
      if (sheet || challenge || lead) report('network_error','Network/CORS failure at '+(sheet?'mock Sheet':challenge?'CRM challenge':'CRM submission')+'. Keep this tab; do not start a new inquiry.');
      throw e;
    }
    if ((sheet || challenge || lead) && !response.ok) {
      let code='';try {const body=await response.clone().json();code=typeof body.error?.code==='string'?body.error.code:'';}catch{}
      report('http_error',(sheet?'Mock Sheet':challenge?'CRM challenge':'CRM submission')+' returned HTTP '+response.status+(code?' / '+code:'')+'. Keep this tab; reconcile before retrying.',{status:response.status});
    }
    if (lead && response.ok) {
      const receipt=await response.clone().json();
      if(receipt.accepted){
        const inquiry=JSON.parse(init.body);delete inquiry.challenge;delete inquiry.website;
        sessionStorage.setItem('codlive-local-last-id',inquiry.submission_id);
        try {
          const observed=await native('/local-receipt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({inquiry,receipt})});
          if(!observed.ok)report('observer_error','CRM acknowledged the order, but local verification receipt could not be recorded. Keep this tab.');
        }catch{report('observer_error','CRM acknowledged the order, but local verification is unavailable. Keep this tab.');}
      }
    }
    return response;
  };
})();
