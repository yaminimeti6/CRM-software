// Browser-only adapter. No credentials. Pending customer data is tab-scoped until acknowledged.
(function () {
  window.createCodLiveCRM = function ({ base, formId, version = 'codlive-v1', storage = sessionStorage, request = fetch }) {
    const key = 'crm-codlive:' + formId;
    let running;
    return function submit(payload, sheetSubmit) {
      if (running) return running;
      running = (async () => {
        let pending = JSON.parse(storage.getItem(key) || 'null');
        if (!pending) {
          const q = new URL(location.href).searchParams;
          const answers = {
            city: payload.city, state: payload.state, pincode: payload.pincode,
            course_name: payload.courseName, course_price: Number(payload.coursePrice.replace(/^Rs\.\s*/, '')),
            landmark: payload.landmark, full_address: payload.fullAddress,
            site_no: location.hostname, page_url: location.href,
            bottle: payload.courseName + ' - ' + payload.coursePrice,
            campId: q.get('utm_source') || '', place: q.get('utm_medium') || '',
            AdCrevId: q.get('utm_campaign') || '', AdCrevName: q.get('utm_content') || '',
            FbClickId: q.get('fbclid') || '', utm_term: q.get('utm_term') || ''
          };
          for (const field of ['campaign_id', 'campaign_name', 'adset_id', 'ad_set_id', 'ad_id', 'ad_name', 'creative_id', 'creative_name', 'ad_account_id']) {
            if (q.has(field)) answers[field] = q.get(field);
          }
          if (payload.order_id !== undefined) answers.order_id = String(payload.order_id);
          pending = { payload, sheetDone: false, crmDone: false, inquiry: {
            form_id: formId, form_version: version, submission_id: crypto.randomUUID(),
            name: payload.name, mobile_no: payload.phone, address: payload.address, answers
          }};
          if (payload.lead_id !== undefined) pending.inquiry.lead_id = String(payload.lead_id);
          storage.setItem(key, JSON.stringify(pending));
        }
        // Freeze both destinations to the original inquiry while either is uncertain.
        const sheet = pending.sheetDone ? Promise.resolve() : sheetSubmit(pending.payload).then(() => {
          pending.sheetDone = true; storage.setItem(key, JSON.stringify(pending));
        });
        const crm = pending.crmDone ? Promise.resolve() : (async () => {
          const query = '?form_id=' + encodeURIComponent(formId);
          const c = await request(base + '/api/public/lead-challenge' + query);
          if (!c.ok) throw Error('CRM verification unavailable');
          const check = await c.json();
          await new Promise(resolve => setTimeout(resolve, Math.max(1000, check.min_wait_ms || 0)));
          const r = await request(base + '/api/public/leads' + query, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...pending.inquiry, challenge: check.challenge, website: '' }) });
          const receipt = await r.json();
          if (!r.ok || !receipt.ok || !receipt.accepted || receipt.submission_id !== pending.inquiry.submission_id) throw Error('CRM receipt not confirmed; retry this order');
          pending.crmDone = true; storage.setItem(key, JSON.stringify(pending));
        })();
        const results = await Promise.allSettled([sheet, crm]);
        if (results.some(r => r.status === 'rejected')) throw Error('Order partially unconfirmed. Retry the same order.');
        storage.removeItem(key);
      })().finally(() => { running = null; });
      return running;
    };
  };
})();
