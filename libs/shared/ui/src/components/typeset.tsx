import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cn } from '@tourism/ui/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

// Wrapper typography cho nội dung render (markdown/rich-text) — ADR-0012.
// Preset đặt 3 biến điều khiển của shadcn/typeset (size/leading/flow),
// định nghĩa trong styles/typeset.css. Thoát style cho phần tử con:
// class `not-typeset` hoặc attr `data-not-typeset`.
const typesetVariants = cva('typeset', {
  variants: {
    preset: {
      docs: 'typeset-docs',
      chat: 'typeset-chat',
      reading: 'typeset-reading',
    },
  },
  defaultVariants: {
    preset: 'docs',
  },
});

function Typeset({
  className,
  preset = 'docs',
  render,
  ...props
}: useRender.ComponentProps<'div'> & VariantProps<typeof typesetVariants>) {
  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(
      {
        className: cn(typesetVariants({ preset }), className),
      },
      props,
    ),
    render,
    state: {
      slot: 'typeset',
      preset,
    },
  });
}

export { Typeset, typesetVariants };
