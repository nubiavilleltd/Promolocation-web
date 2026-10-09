import $ from "jquery";
import "summernote/dist/summernote-lite.css";
import "summernote/dist/summernote-lite";

// Summernote is jQuery based. Expose jQuery globally so the lite build and its
// bundled plugins can find it regardless of how the bundler resolves them.
window.jQuery = window.$ = $;

export default $;
