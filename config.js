// Supabase Configuration
// Replace these values with your actual Supabase project details

const SUPABASE_CONFIG = {
  // Your Supabase project URL (found in Settings > API)
  url: 'https://tgsgeubybnmwpbjomljf.supabase.co',
  
  // Your Supabase anon key (found in Settings > API)
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnc2dldWJ5Ym5td3Biam9tbGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0OTgyMTgsImV4cCI6MjA3NzA3NDIxOH0.f_j2tFkIhUe1KFo5HM8SuFFBtMNBywT6dRpkffT5qBE'
};

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SUPABASE_CONFIG;
} else {
  window.SUPABASE_CONFIG = SUPABASE_CONFIG;
}
