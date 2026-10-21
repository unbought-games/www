const status = document.querySelector('[data-share-status]');
const url = document.querySelector('link[rel="canonical"]').href;
const copy = document.querySelector('[data-copy]');
if (navigator.clipboard && copy) {
  copy.hidden = false;
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); status.textContent = 'Link copied.'; }
    catch { status.textContent = 'Copy the address from your browser to share this post.'; }
  });
}
const share = document.querySelector('[data-share]');
if (navigator.share && share) {
  share.hidden = false;
  share.addEventListener('click', async () => {
    try { await navigator.share({title:document.title,url}); }
    catch (error) { if (error.name !== 'AbortError') status.textContent = 'Use Copy link or Email to share this post.'; }
  });
}
