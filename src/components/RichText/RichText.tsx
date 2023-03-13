import { memo, useEffect, useMemo, useState } from 'react';
import { Box, Flex, FlexProps } from '@chakra-ui/react';

import { dataAttr } from '@chakra-ui/utils';
import Link from '@tiptap/extension-link';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { safeJsonParse } from '~/utils/safeJsonParse';

import { MenuBar } from './RichTextMenu';
import { TIP_TAP_STYLES } from './constants';
import Placeholder from '@tiptap/extension-placeholder';
import { merge } from 'lodash';

interface TextAreaFieldProps extends Omit<FlexProps, 'value' | 'onChange'> {
  value?: string;
  defaultValue?: string;
  isReadOnly?: boolean;
  onChange?: (value: string | undefined, rawValue?: string) => void;
}

const UnmemoedRichText: React.FC<TextAreaFieldProps> = (props) => {
  const { isReadOnly, value, defaultValue, onChange, sx, ...flexProps } = props;
  const [isFocused, setIsFocused] = useState(false);

  const componentStyles = useMemo(() => merge({}, TIP_TAP_STYLES, sx), [sx]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link,
      Placeholder.configure({
        // Use a placeholder:
        placeholder:
          'Add details and give concrete examples to explain how you feel.',
        // Use different placeholders depending on the node type:
        // placeholder: ({ node }) => {
        //   if (node.type.name === 'heading') {
        //     return 'What’s the title?'
        //   }

        //   return 'Can you add some further context?'
        // },
      }),
    ],
    content: safeJsonParse(value),
    editable: !isReadOnly,
    onUpdate: ({ editor }) => {
      if (editor.isEmpty) {
        return onChange?.(undefined);
      }
      const json = editor.getJSON();
      const rawTextValue = editor.getText();
      onChange?.(JSON.stringify(json), rawTextValue);
    },
  });

  // this is required as value will not be set after the first render
  useEffect(() => {
    if (defaultValue && editor) {
      editor.commands.setContent(safeJsonParse(defaultValue));
    }
  }, [defaultValue, editor]);

  return (
    <Flex
      direction="column"
      borderRadius="sm"
      data-group
      _focusWithin={{
        shadow: 'focus',
      }}
      // TODO: Add error or invalid styling
      sx={componentStyles}
      {...flexProps}
    >
      <Box>
        {!isReadOnly && <MenuBar editor={editor} />}
        <Box
          borderBottomRadius="sm"
          borderTopRadius={isReadOnly ? 'sm' : 0}
          mt={isReadOnly ? 0 : '-px'}
          borderWidth="1px"
          borderColor="base.divider.strong"
          _focus={{
            borderColor: 'utility.focus-default',
          }}
          px="1rem"
          py="0.5rem"
          data-focus={dataAttr(isFocused)}
        >
          <EditorContent
            editor={editor}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
        </Box>
      </Box>
    </Flex>
  );
};

export const RichText = memo(UnmemoedRichText);
