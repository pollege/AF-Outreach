"use client";

import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
import Underline from '@tiptap/extension-underline';
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    List, ListOrdered, Link as LinkIcon, Heading2, Heading3,
    Undo, Redo, ExternalLink, Pencil, X, Check, Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    className?: string;
    onEditorReady?: (editor: any) => void;
    customActions?: React.ReactNode;
}

const MenuButton = ({
    isActive,
    onClick,
    children,
    title
}: {
    isActive?: boolean;
    onClick: () => void;
    children: React.ReactNode;
    title?: string;
}) => (
    <button
        type="button" // Prevent form submission
        onClick={onClick}
        title={title}
        className={cn(
            "p-2 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400",
            isActive && "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
        )}
    >
        {children}
    </button>
);

export function RichTextEditor({ value, onChange, placeholder, className, onEditorReady, customActions }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            BubbleMenuExtension,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-500 hover:underline',
                },
            }),
        ],
        content: value,
        editorProps: {
            attributes: {
                class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[150px] px-4 py-3',
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        onCreate: ({ editor }) => {
            if (onEditorReady) onEditorReady(editor);
        },
        immediatelyRender: false,
    });

    // Sync content if value changes externally (and editor is not focused? actually complicated for generic sync)
    // For now, assume controlled mostly one way or initial load.
    // Ideally we verify if content is different to avoid cursor jumps.
    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            // Only update if significantly different to avoid cursor issues
            // editor.commands.setContent(value); 
            // Skipping this for now to prevent loops, assuming local state drives it mostly.
            // If we need reset, we can key the component.
        }
    }, [value, editor]);

    const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');

    const openLinkPopover = () => {
        const previousUrl = editor?.getAttributes('link').href;
        setLinkUrl(previousUrl || '');
        setIsLinkPopoverOpen(true);
    };

    const setLink = () => {
        if (linkUrl === '') {
            editor?.chain().focus().extendMarkRange('link').unsetLink().run();
        } else {
            let finalUrl = linkUrl;
            // Auto-prefix https:// if missing logic
            if (finalUrl && !/^https?:\/\//i.test(finalUrl) && !/^mailto:/i.test(finalUrl)) {
                finalUrl = 'https://' + finalUrl;
            }

            editor?.chain().focus().extendMarkRange('link').setLink({ href: finalUrl }).run();
            // Prevent link extension: click to end and unset mark
            editor?.commands.setTextSelection(editor.state.selection.to);
            editor?.commands.unsetMark('link');
        }
        setIsLinkPopoverOpen(false);
    };

    if (!editor) {
        return <div className="min-h-[200px] border rounded-xl animate-pulse bg-slate-100 dark:bg-slate-900" />;
    }

    return (
        <div className={cn("border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 relative", className)}>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <MenuButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive('bold')}
                    title="Bold"
                >
                    <Bold className="w-4 h-4" />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive('italic')}
                    title="Italic"
                >
                    <Italic className="w-4 h-4" />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    isActive={editor.isActive('underline')}
                    title="Underline"
                >
                    <UnderlineIcon className="w-4 h-4" />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    isActive={editor.isActive('strike')}
                    title="Strikethrough"
                >
                    <Strikethrough className="w-4 h-4" />
                </MenuButton>

                <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1" />

                <MenuButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    isActive={editor.isActive('heading', { level: 2 })}
                    title="Heading 2"
                >
                    <Heading2 className="w-4 h-4" />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    isActive={editor.isActive('heading', { level: 3 })}
                    title="Heading 3"
                >
                    <Heading3 className="w-4 h-4" />
                </MenuButton>

                <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1" />

                <MenuButton
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    isActive={editor.isActive('bulletList')}
                    title="Bullet List"
                >
                    <List className="w-4 h-4" />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    isActive={editor.isActive('orderedList')}
                    title="Ordered List"
                >
                    <ListOrdered className="w-4 h-4" />
                </MenuButton>

                <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1" />

                <div className="relative">
                    <MenuButton
                        onClick={openLinkPopover}
                        isActive={editor.isActive('link')}
                        title="Link"
                    >
                        <LinkIcon className="w-4 h-4" />
                    </MenuButton>

                    {isLinkPopoverOpen && !editor.isActive('link') && (
                        <div className="absolute top-full mt-2 right-0 z-50 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-xl rounded-xl p-3 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-200">
                            {/* ... existing link popover content ... */}
                            <input
                                autoFocus
                                type="url"
                                placeholder="Paste URL here..."
                                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') setLink();
                                    if (e.key === 'Escape') setIsLinkPopoverOpen(false);
                                }}
                            />
                            <div className="flex justify-between gap-2">
                                {editor.isActive('link') && (
                                    <button
                                        onClick={() => {
                                            editor.chain().focus().unsetLink().run();
                                            setIsLinkPopoverOpen(false);
                                        }}
                                        className="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    >
                                        Remove
                                    </button>
                                )}
                                <div className="flex gap-2 ml-auto">
                                    <button
                                        onClick={() => setIsLinkPopoverOpen(false)}
                                        className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={setLink}
                                        className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm shadow-blue-500/20"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Custom Actions */}
                {customActions && (
                    <>
                        <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1" />
                        {customActions}
                    </>
                )}
            </div>

            <EditorContent editor={editor} />

            {editor && (
                <BubbleMenu
                    editor={editor}
                    tippyOptions={{ duration: 100 }}
                    shouldShow={({ editor }: { editor: any }) => editor.isActive('link')}
                    className="flex items-center gap-1 p-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl"
                >
                    {isLinkPopoverOpen ? (
                        <div className="flex items-center gap-2 p-1">
                            <input
                                autoFocus
                                type="url"
                                placeholder="https://..."
                                className="w-48 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') setLink();
                                    if (e.key === 'Escape') setIsLinkPopoverOpen(false);
                                }}
                            />
                            <button onClick={setLink} className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 rounded">
                                <Check className="w-3 h-3" />
                            </button>
                            <button onClick={() => setIsLinkPopoverOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1">
                            <a
                                href={editor.getAttributes('link').href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-500 hover:underline px-2 max-w-[150px] truncate"
                            >
                                {editor.getAttributes('link').href}
                            </a>
                            <div className="w-px h-4 bg-slate-200 dark:bg-white/10" />
                            <button
                                onClick={openLinkPopover}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded"
                                title="Edit Link"
                            >
                                <Pencil className="w-3 h-3" />
                            </button>
                            <button
                                onClick={() => editor.chain().focus().unsetLink().run()}
                                className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded"
                                title="Remove Link"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </BubbleMenu>
            )}

            {/* Click outside listener could be added here for perfection, but simplified for now */}
            {isLinkPopoverOpen && !editor.isActive('link') && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsLinkPopoverOpen(false)}
                />
            )}
        </div>
    );
}
