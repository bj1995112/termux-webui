import { useCallback, useEffect, useRef, useState } from "react";
import { deckSocket } from "../lib/ws.js";
import { useDeck } from "../store.js";

interface KeyDef {
  label: string;
  seq: string | null;
  sub?: string;
}

const key = (label: string, seq: string | null, sub?: string): KeyDef => ({ label, seq, sub });

const TERMUX_ROW1 = [
  key("Esc", "\x1b"), key("/", "/"), key("-", "-"), key("Home", "\x1b[H"), key("↑", "\x1b[A"), key("End", "\x1b[F"), key("PgUp", "\x1b[5~"),
];
const TERMUX_ROW2 = [
  key("Tab", "\t"), key("Ctrl", null), key("Alt", null), key("←", "\x1b[D"), key("↓", "\x1b[B"), key("→", "\x1b[C"), key("PgDn", "\x1b[6~"),
];

const QUICK_ROW1 = [
  key("搜索历史", "\x12", "Ctrl+R"), key("删除单词", "\x17", "Ctrl+W"), key("清空左侧", "\x15", "Ctrl+U"), key("清空右侧", "\x0b", "Ctrl+K"), key("取消输入", "\x03", "Ctrl+C"), key("挂起程序", "\x1a", "Ctrl+Z"), key("清屏", "\x0c", "Ctrl+L"),
];
const QUICK_ROW2 = [
  key("退出 / EOF", "\x04", "Ctrl+D"), key("撤销", "\x1f", "Ctrl+_"), key("重做", "\x19", "Ctrl+Y"), key("中止", "\x18", "Ctrl+X"), key("取消", "\x07", "Ctrl+G"), key("提交", "\r", "Enter"), key("补全", "\t", "Tab"),
];

const FN_ROW1 = [key("F1", "\x1bOP"), key("F2", "\x1bOQ"), key("F3", "\x1bOR"), key("F4", "\x1bOS"), key("F5", "\x1b[15~"), key("F6", "\x1b[17~"), key("F7", "\x1b[18~")];
const FN_ROW2 = [key("F8", "\x1b[19~"), key("F9", "\x1b[20~"), key("F10", "\x1b[21~"), key("F11", "\x1b[23~"), key("F12", "\x1b[24~"), key("Ins", "\x1b[2~"), key("Del", "\x1b[3~")];
const SYMBOL_ROW1 = [key("~", "~"), key("`", "`"), key("|", "|"), key("\\", "\\"), key("/", "/"), key("$", "$"), key("#", "#")];
const SYMBOL_ROW2 = [key("&", "&"), key(";", ";"), key(">", ">"), key("<", "<"), key("=", "="), key("*", "*"), key("_", "_")];

interface KeyboardPage { id: string; label: string; rows: KeyDef[][]; custom?: boolean }
interface CustomPage { id: string; label: string; keys: { label: string; seq: string }[] }
const CUSTOM_STORAGE = "twui.customKeyboardPages";
const readCustomPages = (): CustomPage[] => { try { const value = JSON.parse(localStorage.getItem(CUSTOM_STORAGE) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } };
const builtInPages = (): KeyboardPage[] => [
  { id: "termux", label: "Termux", rows: [TERMUX_ROW1, TERMUX_ROW2] },
  { id: "quick", label: "快捷", rows: [QUICK_ROW1, QUICK_ROW2] },
  { id: "fn", label: "Fn", rows: [FN_ROW1, FN_ROW2] },
  { id: "symbols", label: "符号", rows: [SYMBOL_ROW1, SYMBOL_ROW2] },
];
function useMemoPages(customPages: CustomPage[]): KeyboardPage[] { return [...builtInPages(), ...customPages.map(p => ({ id:p.id, label:p.label, custom:true, rows:[p.keys.slice(0,7).map(k=>key(k.label,k.seq)), p.keys.slice(7,14).map(k=>key(k.label,k.seq))] }))]; }

export default function QuickKeyboard({ sessionId, onHide: _onHide }: { sessionId: string; onHide: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null); const keyboardRef = useRef<HTMLDivElement>(null);
  const [page,setPage]=useState(0); const [customPages,setCustomPages]=useState<CustomPage[]>(readCustomPages); const [mods,setMods]=useState({ctrl:false,alt:false,shift:false});
  const pages=useMemoPages(customPages); const displayPages=pages.length?[pages[pages.length-1],...pages,pages[0]]:[];
  useEffect(()=>{const f=()=>setCustomPages(readCustomPages());window.addEventListener("twui-custom-keyboard-pages",f);return()=>window.removeEventListener("twui-custom-keyboard-pages",f)},[]);
  useEffect(()=>{const el=scrollRef.current;if(el&&pages.length)el.scrollLeft=el.clientWidth;setPage(0)},[pages.length]);
  useEffect(()=>{const el=keyboardRef.current,vv=window.visualViewport;if(!el||!vv)return;const u=()=>{const overlap=Math.max(0,window.innerHeight-vv.height-vv.offsetTop);el.style.bottom=`${overlap}px`};u();vv.addEventListener("resize",u);vv.addEventListener("scroll",u);window.addEventListener("orientationchange",u);return()=>{vv.removeEventListener("resize",u);vv.removeEventListener("scroll",u);window.removeEventListener("orientationchange",u)}},[]);
  const send=useCallback((seq:string)=>{deckSocket.send({type:"input",sessionId,data:seq});navigator.vibrate?.(10)},[sessionId]);
  const pasteClipboard=useCallback(async()=>{try{const text=await navigator.clipboard?.readText();if(text)send(text)}catch{}},[send]);
  const sendKey=useCallback((item:KeyDef)=>{if(item.seq==="__PASTE__"){void pasteClipboard();return}let seq=item.seq??"";if(mods.ctrl&&item.label.length===1){const code=item.label.toUpperCase().charCodeAt(0);if(code>=64&&code<=95)seq=String.fromCharCode(code-64)}else if(mods.alt&&item.seq)seq=`\x1b${item.seq}`;else if(mods.shift&&item.label.length===1)seq=item.label.toUpperCase();send(seq);setMods({ctrl:false,alt:false,shift:false})},[mods,pasteClipboard,send]);
  const handleScroll=useCallback(()=>{const el=scrollRef.current;if(!el||!el.clientWidth||!pages.length)return;const raw=Math.round(el.scrollLeft/el.clientWidth);if(raw<=0){el.scrollLeft=pages.length*el.clientWidth;setPage(pages.length-1)}else if(raw>=pages.length+1){el.scrollLeft=el.clientWidth;setPage(0)}else setPage(raw-1)},[pages.length]);
  const renderKey=useCallback((k:KeyDef)=><button key={k.label+(k.seq??"")} type="button" className={`flex h-full min-h-0 w-full flex-col items-center justify-center rounded-md border border-border bg-panel2 px-1 text-[12px] leading-tight active:bg-accent/30 ${k.seq===null?"text-muted":"text-text"}`} onClick={()=>{if(k.seq===null){const name=k.label.toLowerCase() as "ctrl"|"alt"|"shift";setMods(m=>({...m,[name]:!m[name]}))}else sendKey(k)}} onContextMenu={e=>e.preventDefault()}><span className={mods[k.label.toLowerCase() as "ctrl"|"alt"|"shift"]?"font-bold text-accent":""}>{k.label}</span>{k.sub&&<span className="text-[9px] text-muted truncate max-w-full">{k.sub}</span>}</button>,[mods,sendKey]);
  return <div ref={keyboardRef} className="fixed left-0 right-0 z-50 select-none border-t border-border bg-panel" style={{bottom:"0px",paddingBottom:"0px"}}><div ref={scrollRef} onScroll={handleScroll} className="flex h-[72px] w-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-none" style={{WebkitOverflowScrolling:"touch",touchAction:"pan-x",overscrollBehaviorX:"contain"}}>{displayPages.map((p,i)=><div key={`${p.id}-${i}`} className="h-full w-full shrink-0 snap-center p-1"><div className="flex h-full flex-col gap-1">{p.rows.map((row,ri)=><div key={ri} className="grid min-h-0 flex-1 gap-1" style={{gridTemplateColumns:`repeat(${Math.max(row.length,1)},minmax(0,1fr))`}}>{row.map(renderKey)}</div>)}</div></div>)}</div>{pages.length>1&&<div className="pointer-events-none absolute bottom-0.5 left-0 right-0 flex justify-center gap-1">{pages.map((p,i)=><span key={p.id} className={`h-1 w-1 rounded-full ${i===page?"bg-accent":"bg-muted/40"}`}/>)}</div>}</div>;
}
