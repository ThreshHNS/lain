(function () {
  const body = document.body;
  const currentMode = body.dataset.sceneMode === 'slasher' ? 'slasher' : 'awp';
  const sceneRoot = body.dataset.sceneRoot || '../';
  const links = Array.from(document.querySelectorAll('.mode-link[data-target-mode]'));

  function buildTargetUrl(targetMode) {
    const nextUrl = new URL(
      `${sceneRoot}${targetMode === 'slasher' ? 'slasher/' : 'awp/'}`,
      window.location.href,
    );
    const nextSearch = new URLSearchParams(window.location.search);
    nextSearch.delete('mode');
    nextUrl.search = nextSearch.toString();
    nextUrl.hash = window.location.hash;
    return nextUrl;
  }

  links.forEach((link) => {
    const targetMode = link.dataset.targetMode === 'slasher' ? 'slasher' : 'awp';
    const targetUrl = buildTargetUrl(targetMode);

    link.href = targetUrl.toString();

    if (targetMode === currentMode) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    } else {
      link.classList.remove('is-active');
      link.removeAttribute('aria-current');
    }

    link.addEventListener('click', (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      if (targetMode === currentMode) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      body.dataset.routeTransition = 'true';

      window.setTimeout(() => {
        window.location.assign(targetUrl.toString());
      }, 220);
    });
  });
})();
