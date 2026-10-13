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
          // Detect newly added images and place the cursor after the last one
          const hasNewImage =
            /<img[\s>]/i.test(contents) &&
            !/<img[\s>]/i.test(lastEmittedValueRef.current);

          lastEmittedValueRef.current = contents;
          onChangeRef.current?.(contents);

          if (hasNewImage) {
            // Use setTimeout to let Summernote finish its internal DOM update
            setTimeout(() => {
              const $imgs = $editor.find("img");
              if ($imgs.length === 0) return;

              const lastImg = $imgs.last()[0];
              const range = $editor.summernote("createRange");
              range.setStartAfter(lastImg);
              range.collapse(true);

              const selection = window.getSelection();
              if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);
              }
            }, 10);
          }
        },
        onInit: function () {
          const $editable = $editor.find(".note-editable");

          // Show a remove button when clicking on an image
          $editable.on("click", "img", function (e) {
            e.preventDefault();
            e.stopPropagation();

            // Remove any existing remove button
            $editable.find(".img-remove-btn").remove();

            const $img = $(this);
            const $btn = $(
              '<button class="img-remove-btn" title="Remove image" type="button">&times;</button>'
            );

            // Position the button at the top-right corner of the image
            const imgOffset = $img.offset();
            const editableOffset = $editable.offset();
            $btn.css({
              position: "absolute",
              top: imgOffset.top - editableOffset.top + "px",
              left:
                imgOffset.left -
                editableOffset.left +
                $img.outerWidth() -
                20 +
                "px",
              zIndex: 9999,
            });

            $btn.on("click", function (e) {
              e.preventDefault();
              e.stopPropagation();
              $img.remove();
              $(this).remove();

              // Update the editor content after removal
              const newContents = $editor.summernote("code");
              lastEmittedValueRef.current = newContents;
              onChangeRef.current?.(newContents);
            });

            $editable.append($btn);
          });

          // Remove the button when clicking elsewhere
          $editable.on("click", function (e) {
            if (!$(e.target).is("img")) {
              $editable.find(".img-remove-btn").remove();
            }
          });
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
