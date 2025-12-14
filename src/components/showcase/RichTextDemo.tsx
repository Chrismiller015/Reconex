"use client";

import StarterKit from "@tiptap/starter-kit";
import {
  MenuButtonBold,
  MenuButtonItalic,
  MenuButtonStrikethrough,
  MenuButtonUnderline,
  MenuControlsContainer,
  MenuDivider,
  MenuSelectHeading,
  RichTextEditor,
  type RichTextEditorRef,
} from "mui-tiptap";
import { useRef } from "react";

const initialContent = `
  <h2>Rich Text Editor</h2>
  <p>
    This editor is powered by <strong>mui-tiptap</strong>, giving you a fully themed Tiptap experience without
    leaving the MUI design system. Try selecting text and applying the formatting controls above.
  </p>
  <ul>
    <li>Bold, italic, underline, and strike-through controls are included.</li>
    <li>Headings automatically match the active theme.</li>
  </ul>
`;

export const RichTextDemo = () => {
  const editorRef = useRef<RichTextEditorRef>(null);

  return (
    <RichTextEditor
      ref={editorRef}
      content={initialContent}
      extensions={[StarterKit]}
      immediatelyRender={false}
      renderControls={() => (
        <MenuControlsContainer>
          <MenuSelectHeading />
          <MenuDivider />
          <MenuButtonBold />
          <MenuButtonItalic />
          <MenuButtonUnderline />
          <MenuButtonStrikethrough />
        </MenuControlsContainer>
      )}
    />
  );
};
