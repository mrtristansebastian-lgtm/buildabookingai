(() => {
  try {
    const target = new URL(window.location.href);
    target.searchParams.set('buildRecovery', String(Date.now()));
    sessionStorage.setItem('build-a-booking-cache-recovery', 'index-C02QZD-F');
    window.location.replace(target.toString());
  } catch (error) {
    window.location.href = `/?buildRecovery=${Date.now()}`;
  }
})();
