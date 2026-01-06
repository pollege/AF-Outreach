"use client";

import React, { useState, useRef, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailTagInputProps {
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    className?: string;
    id?: string;
}

export function EmailTagInput({ value = [], onChange, placeholder, className, id }: EmailTagInputProps) {
    const [inputValue, setInputValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" || e.key === "," || e.key === "Tab" || e.key === " ") {
            e.preventDefault();
            addTag(inputValue);
        } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
            removeTag(value.length - 1);
        }
    };

    const isValidEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const addTag = (tag: string) => {
        const trimmed = tag.trim().replace(/[,;]/g, '');
        if (trimmed && !value.includes(trimmed)) {
            onChange([...value, trimmed]);
            setInputValue("");
        } else if (trimmed && value.includes(trimmed)) {
            setInputValue(""); // Clear duplicate
        }
    };

    const removeTag = (index: number) => {
        const newValue = [...value];
        newValue.splice(index, 1);
        onChange(newValue);
    };

    return (
        <div
            className={cn(
                "flex flex-wrap items-center gap-1.5 min-h-[28px] py-0.5",
                className
            )}
            onClick={() => inputRef.current?.focus()}
        >
            {value.map((tag, index) => {
                const isValid = isValidEmail(tag);
                return (
                    <div
                        key={index}
                        className={cn(
                            "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border animate-in fade-in zoom-in-95 duration-150",
                            isValid
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                                : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
                        )}
                    >
                        <span>{tag}</span>
                        {!isValid && <span className="ml-1 text-[10px] opacity-70">⚠</span>}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                removeTag(index);
                            }}
                            className={cn(
                                "w-3.5 h-3.5 flex items-center justify-center rounded-full transition-colors ml-1",
                                isValid
                                    ? "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600"
                                    : "hover:bg-red-200 dark:hover:bg-red-800/40 text-red-400 hover:text-red-600"
                            )}
                        >
                            <X className="w-2.5 h-2.5" />
                        </button>
                    </div>
                );
            })}
            <input
                ref={inputRef}
                id={id}
                type="text"
                className="flex-1 bg-transparent !border-none !outline-none !ring-0 !shadow-none p-0 text-sm min-w-[120px] placeholder:text-slate-400 text-slate-900 dark:text-slate-100 caret-blue-600 dark:caret-blue-400 h-7"
                placeholder={value.length === 0 ? placeholder : ""}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => addTag(inputValue)}
            />
        </div>
    );
}
