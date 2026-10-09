import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import $ from "../lib/summernote";

/**
 * Thin React wrapper around Summernote. It keeps a jQuery/summernote instance in
 * sync with a controlled HTML string and lets users paste images directly into
 * the field (Summernote embeds them as base64, which is saved with the details).
 * The toolbar is intentionally hidden so the field behaves like a plain textarea
 * that also accepts pasted images.
 */
const RichTextEditor = forwardRef(function RichTextEditor(
  {
    id,
    value = "",
    onChange,
    disabled = false,
    placeholder = "",
    minHeight = 240,
  },
  ref,
) {
  const editorRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const lastEmittedValueRef = useRef(value ?? "");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Expose the live editor HTML so forms can read the latest value on submit
  // instead of relying on Summernote's debounced onChange callback.
  useImperativeHandle(
    ref,
    () => ({
      getHtml: () => {
        const $editor = $(editorRef.current);

        return $editor.data("summernote")
          ? $editor.summernote("code")
          : value ?? "";
      },
    }),
    [value],
  );

  useEffect(() => {
    const element = editorRef.current;

    if (!element) {
      return undefined;
    }

    const $editor = $(element);
    $editor.html(value ?? "");
    lastEmittedValueRef.current = value ?? "";

    $editor.summernote({
      placeholder,
      minHeight,
      height: minHeight,
      focus: false,
      dialogsInBody: true,
      disableDragAndDrop: true,
      toolbar: [],
      callbacks: {
        onChange: (contents) => {
          lastEmittedValueRef.current = contents;
          onChangeRef.current?.(contents);
        },
      },
    });

    return () => {
      $editor.summernote("destroy");
    };
    // Initialise once; subsequent prop changes are handled by dedicated effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push externally-driven value changes into the editor without disturbing the
  // caret while the user is typing.
  useEffect(() => {
    const $editor = $(editorRef.current);

    if (!$editor.data("summernote")) {
      return;
    }

    const nextValue = value ?? "";

    if (nextValue === lastEmittedValueRef.current) {
      return;
    }

    lastEmittedValueRef.current = nextValue;
    $editor.summernote("code", nextValue);
  }, [value]);

  useEffect(() => {
    const $editor = $(editorRef.current);

    if (!$editor.data("summernote")) {
      return;
    }

    if (disabled) {
      $editor.summernote("disable");
    } else {
      $editor.summernote("enable");
    }
  }, [disabled]);

  return (
    <div className="premium-rich-editor">
      <div id={id} ref={editorRef} />
    </div>
  );
});

export default RichTextEditor;
