// Display original reported values without inferring provider object identities.
export function orderTracking(answers: Record<string, unknown> = {}) {
  const labels: Record<string, string> = {
    utm_campaign: 'Campaign (UTM)', utm_content: 'Content (UTM)', utm_medium: 'Medium (UTM)',
    utm_term: 'Term (UTM)', AdCrevId: 'Legacy AdCrevId', AdCrevName: 'Legacy AdCrevName',
    place: 'Legacy place', campaign_id: 'Campaign ID', campaign_name: 'Campaign name',
    adset_id: 'Ad set ID', ad_set_id: 'Ad set ID', ad_id: 'Ad ID', ad_name: 'Ad name',
    creative_id: 'Creative ID', creative_name: 'Creative name', ad_account_id: 'Ad account ID',
  };
  return Object.entries(labels).flatMap(([key, label]) => {
    const v = answers[key];
    return (typeof v === 'string' && v.trim()) || (typeof v === 'number' && Number.isFinite(v))
      ? [{key, label, value: String(v)}] : [];
  });
}
