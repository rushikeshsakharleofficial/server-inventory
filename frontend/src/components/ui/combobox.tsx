import { useControllableState } from '@radix-ui/react-use-controllable-state'
import { ChevronsUpDown, Plus } from 'lucide-react'
import {
  type ComponentProps, createContext, type ReactNode,
  useContext, useEffect, useRef, useState,
} from 'react'
import { Button } from './button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from './command'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { cn } from '../../lib/cn'

export interface ComboboxData { label: string; value: string }

interface ComboboxCtx {
  data: ComboboxData[]; type: string
  value: string; onValueChange: (v: string) => void
  open: boolean; onOpenChange: (o: boolean) => void
  width: number; setWidth: (w: number) => void
  inputValue: string; setInputValue: (v: string) => void
}

const Ctx = createContext<ComboboxCtx>({
  data: [], type: 'item', value: '', onValueChange: () => {},
  open: false, onOpenChange: () => {}, width: 200, setWidth: () => {},
  inputValue: '', setInputValue: () => {},
})

export type ComboboxProps = ComponentProps<typeof Popover> & {
  data: ComboboxData[]; type: string
  defaultValue?: string; value?: string; onValueChange?: (v: string) => void
  open?: boolean; onOpenChange?: (o: boolean) => void
}

export function Combobox({ data, type, defaultValue, value: cv, onValueChange: cov, defaultOpen = false, open: co, onOpenChange: coo, ...props }: ComboboxProps) {
  const [value, onValueChange] = useControllableState({ defaultProp: defaultValue ?? '', prop: cv, onChange: cov })
  const [open, onOpenChange] = useControllableState({ defaultProp: defaultOpen, prop: co, onChange: coo })
  const [width, setWidth] = useState(200)
  const [inputValue, setInputValue] = useState('')
  return (
    <Ctx.Provider value={{ type, value, onValueChange, open, onOpenChange, data, width, setWidth, inputValue, setInputValue }}>
      <Popover onOpenChange={onOpenChange} open={open} {...props} />
    </Ctx.Provider>
  )
}

export function ComboboxTrigger({ children, className, ...props }: Omit<ComponentProps<typeof Button>, 'ref'>) {
  const { value, data, type, setWidth } = useContext(Ctx)
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      const w = (entries[0]?.target as HTMLElement)?.offsetWidth
      if (w) setWidth(w)
    })
    if (ref.current) ro.observe(ref.current)
    return () => ro.disconnect()
  }, [setWidth])
  return (
    <PopoverTrigger asChild>
      <Button variant="outline" className={cn('w-full', className)} ref={ref} {...(props as any)}>
        {children ?? (
          <span className="flex w-full items-center justify-between gap-2">
            <span className="truncate">{value ? (data.find(i => i.value === value)?.label ?? value) : `Select ${type}…`}</span>
            <ChevronsUpDown size={14} className="shrink-0 opacity-50" />
          </span>
        )}
      </Button>
    </PopoverTrigger>
  )
}

export function ComboboxContent({ className, popoverOptions, ...props }: ComponentProps<typeof Command> & { popoverOptions?: ComponentProps<typeof PopoverContent> }) {
  const { width } = useContext(Ctx)
  return (
    <PopoverContent className={cn('p-0', className)} style={{ width }} {...popoverOptions}>
      <Command {...props} />
    </PopoverContent>
  )
}

export function ComboboxInput({ value: cv, defaultValue, onValueChange: cov, ...props }: ComponentProps<typeof CommandInput> & { value?: string; defaultValue?: string; onValueChange?: (v: string) => void }) {
  const { type, inputValue, setInputValue } = useContext(Ctx)
  const [value, onValueChange] = useControllableState({
    defaultProp: defaultValue ?? inputValue, prop: cv,
    onChange: v => { setInputValue(v); cov?.(v) },
  })
  return <CommandInput onValueChange={onValueChange} placeholder={`Search ${type}…`} value={value} {...props} />
}

export const ComboboxList = (props: ComponentProps<typeof CommandList>) => <CommandList {...props} />
export function ComboboxEmpty({ children, ...props }: ComponentProps<typeof CommandEmpty>) {
  const { type } = useContext(Ctx)
  return <CommandEmpty {...props}>{children ?? `No ${type} found.`}</CommandEmpty>
}
export const ComboboxGroup = (props: ComponentProps<typeof CommandGroup>) => <CommandGroup {...props} />
export function ComboboxItem(props: ComponentProps<typeof CommandItem>) {
  const { onValueChange, onOpenChange } = useContext(Ctx)
  return <CommandItem onSelect={v => { onValueChange(v); onOpenChange(false) }} {...props} />
}
export const ComboboxSeparator = (props: ComponentProps<typeof CommandSeparator>) => <CommandSeparator {...props} />

export interface ComboboxCreateNewProps {
  onCreateNew: (value: string) => void
  children?: (inputValue: string) => ReactNode
  className?: string
}
export function ComboboxCreateNew({ onCreateNew, children, className }: ComboboxCreateNewProps) {
  const { inputValue, onValueChange, onOpenChange } = useContext(Ctx)
  if (!inputValue.trim()) return null
  return (
    <button
      type="button"
      className={cn('relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-[var(--tx1)] hover:bg-[var(--ac-bg)] hover:text-[var(--ac)] outline-none', className)}
      onClick={() => { onCreateNew(inputValue.trim()); onValueChange(inputValue.trim()); onOpenChange(false) }}
    >
      {children ? children(inputValue) : (
        <><Plus size={14} className="opacity-60" /><span>Create "{inputValue}"</span></>
      )}
    </button>
  )
}
