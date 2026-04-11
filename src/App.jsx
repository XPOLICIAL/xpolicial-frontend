import React, { useState, useEffect, useRef } from 'react';
import { supabase } from "./supabaseClient";
import { Shield, Settings, Folder, FolderPlus, Plus, Trash2, Send, ChevronRight, ChevronDown, FileText, Upload, X, Mic, Eraser, LogOut, UserPlus, Download, BookOpen, Image as ImageIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

function App() {
const [isTyping, setIsTyping] = useState(false);
const [user, setUser] = useState(null);
const [userData, setUserData] = useState(null);
const [loading, setLoading] = useState(true);
const [isRegistering, setIsRegistering] = useState(false);
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [recomanatPer, setRecomanatPer] = useState('');
const [cosPolicial, setCosPolicial] = useState('');
const [acceptTerms, setAcceptTerms] = useState(false);

const [isGestor, setIsGestor] = useState(false); 
const [folders, setFolders] = useState([]);
const [messages, setMessages] = useState([]);
const [selectedFolder, setSelectedFolder] = useState('GENERAL');
const [isGestióUsuaris, setIsGestióUsuaris] = useState(false);
const [allUsers, setAllUsers] = useState([]);
const [input, setInput] = useState('');
const [isListening, setIsListening] = useState(false);
const [pendingPhotos, setPendingPhotos] = useState([]); 
const recognitionRef = useRef(null);
const finalTranscriptRef = useRef('');
const scrollRef = useRef(null);
const fileInputRef = useRef(null);
const photoInputRef = useRef(null);
const [mobileView, setMobileView] = useState("folders");

const cleanFileName = (name) => {
if (!name) return "";
return name.toLowerCase().replace(/\s+/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9._-]/g, '');
};

useEffect(() => {
supabase.auth.getSession().then(({ data: { session } }) => { handleUserChange(session?.user ?? null); });
const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { handleUserChange(session?.user ?? null); });
return () => subscription.unsubscribe();
}, []);

const handleUserChange = async (authUser) => {
if (authUser) {
const { data } = await supabase.from('usuaris').select('*').eq('id', authUser.id).maybeSingle();
if (data && data.estat === 'ACTIU') { setUser(authUser); setUserData(data); }
else if (data) { alert(data.estat === 'BLOQUEJAT' ? "❌ ACCÉS BLOQUEJAT" : "⚠️ PENDENT D'ACTIVACIÓ"); await supabase.auth.signOut(); }
else { setUser(null); setUserData(null); }
} else { setUser(null); setUserData(null); }
setLoading(false);
};

useEffect(() => {
if (!user) return;
const fetchConfig = async () => {
const { data } = await supabase.from('configuracio').select('estructura').eq('id', 'sidebar').maybeSingle();
if (data?.estructura) { 
const llista = data.estructura.folders || data.estructura; 
setFolders(Array.isArray(llista) ? llista : []); 
}
};
fetchConfig();
const fetchMessages = async () => {
const { data } = await supabase.from('missatges').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
if (data) setMessages(data);
};
fetchMessages();
if (userData?.nivell?.includes(5)) {
const fetchUsers = async () => { const { data } = await supabase.from('usuaris').select('*'); if (data) setAllUsers(data); };
fetchUsers();
}
}, [user, userData]);

const descarregarActaWord = async (textIA) => {
try {
const textNet = textIA.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/^[-*]\s+/gm, '• ');
const res = await fetch('https://x-policial-backend.onrender.com/generar_word', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ text: textNet, titol: selectedFolder.toUpperCase() }),
});
const blob = await res.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a'); a.href = url; a.download = `ACTA_${selectedFolder.replace(/\s+/g, '_')}.docx`; a.click();
} catch (e) { alert("❌ Error al generar el Word."); }
};

const syncFolders = async (nova) => { await supabase.from('configuracio').upsert({ id: 'sidebar', estructura: { folders: nova } }); setFolders(nova); };

const findFolderByName = (list, name) => {
for (const item of list) {
if (item.name === name) return item;
if (item.subfolders) { const found = findFolderByName(item.subfolders, name); if (found) return found; }
}
return null;
};

const checkInheritance = (list, targetName, parentTarget = "REDACCIÓ DE DOCUMENTS") => {
for (const item of list) {
if (item.name === parentTarget) {
const checkDeep = (sublist) => {
for (const sub of sublist) {
if (sub.name === targetName) return true;
if (sub.subfolders && checkDeep(sub.subfolders)) return true;
}
return false;
};
if (item.name === targetName || (item.subfolders && checkDeep(item.subfolders))) return true;
}
if (item.subfolders && checkInheritance(item.subfolders, targetName, parentTarget)) return true;
}
return false;
};

const toggleFolder = (id) => {
const update = (list) => list.map(i => i.id === id ? {...i, isOpen: !i.isOpen} : {...i, subfolders: update(i.subfolders || [])});
syncFolders(update(folders));
};

const addFolder = (parentId = null) => {
const name = prompt("NOM DE LA CARPETA:"); if (!name) return;
const levelInput = prompt("ACCÉS (1,2,3,4,5):", "1"); if (!levelInput) return;
const esFoto = confirm("📊 TIPUS DE CARPETA:\n\nPrem 'D'acord' per a FOTOS/REPORTATGES.\nPrem 'Cancel·la' per a DOCUMENTS."); 
const levels = levelInput.split(',').map(n => parseInt(n.trim()));
const newObj = { id: Date.now(), name: name.toUpperCase(), level: levels, isOpen: true, files: [], subfolders: [], isPhotoFolder: esFoto };
const update = (list) => {
if (!parentId) return [...list, newObj];
return list.map(i => i.id === parentId ? {...i, isOpen: true, subfolders: [...(i.subfolders || []), newObj]} : {...i, subfolders: update(i.subfolders || [])});
};
syncFolders(update(folders));
};

const deleteFolder = (id) => {
if (!confirm("Eliminar carpeta i tot el seu contingut?")) return;
const update = (list) => list.filter(i => i.id !== id).map(i => ({...i, subfolders: update(i.subfolders || [])}));
syncFolders(update(folders));
};

const deleteFile = async (folderId, fileName) => {
if (!confirm(`Eliminar ${fileName}?`)) return;
try {
// 🔥 FIX: FormData com pujar_document!
const formData = new FormData();
formData.append("file_path", fileName);
formData.append("carpeta", selectedFolder || "GENERAL");
const response = await fetch('https://x-policial-backend.onrender.com/esborrar_document', {
method: 'POST',
body: formData // ← NO headers JSON!
});
if (!response.ok) {
const errorData = await response.json();
throw new Error(errorData.detail || "Error backend");
}
const data = await response.json();
console.log("✅ Esborrat:", data);
const updateFolders = (list) => list.map(i => 
i.id === folderId 
? { ...i, files: i.files.filter(f => f !== fileName) } 
: { ...i, subfolders: updateFolders(i.subfolders || []) }
);
syncFolders(updateFolders(folders));
} catch (e) {
console.error("❌ Error:", e);
alert("❌ " + e.message);
}
};

// --- FUNCIÓ DE PUJADA DEFINITIVA (BACKEND + ESTAT) ---
const handleFileUpload = async (e, forcedFolderId = null) => {
const file = e.target.files[0]; 
if (!file) return;
const cleanedName = cleanFileName(file.name);
const carpetaDesti = selectedFolder || "GENERAL";

try {
console.log(`📤 Enviant fitxer al Backend: ${cleanedName} a ${carpetaDesti}`);
const formData = new FormData();
formData.append("file", file, cleanedName);
formData.append("carpeta_actual", carpetaDesti);

// 1. Enviem al nostre Uvicorn (ell s'encarrega de Supabase i de la IA)
const response = await fetch('https://x-policial-backend.onrender.com/pujar_document', {
method: 'POST',
body: formData
});

if (!response.ok) {
const errorData = await response.json();
throw new Error(errorData.detail || "Error en la resposta del servidor");
}

const data = await response.json();
console.log("✅ Resposta Backend:", data);

// 2. Actualitzem la interfície (perquè vegis el fitxer a la llista sense refrescar)
const updateFolders = (list) => list.map(folder => {
// Si és la carpeta on hem pujat, li afegim el fitxer a la llista
if (folder.name === carpetaDesti || folder.id === parseInt(forcedFolderId)) {
return { 
...folder, 
files: [...new Set([...(folder.files || []), file.name])],
hasFiles: true 
};
}
// Si té subcarpetes, seguim buscant dins d'elles
if (folder.subfolders) {
return { ...folder, subfolders: updateFolders(folder.subfolders) };
}
return folder;
});

syncFolders(updateFolders(folders));
alert(`✅ Fitxer "${file.name}" pujat i indexat correctament.`);

} catch (err) {
console.error("❌ Error en la pujada:", err);
alert("❌ Error: " + err.message);
} finally {
e.target.value = null; // Netegem l'input per poder tornar a pujar el mateix fitxer si cal
}
};

  const handlePhotoUploadChat = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const cleanedName = cleanFileName(file.name);
// MODIFICACIÓ: Ordenem les fotos de xat també per la carpeta que tinguis oberta en aquell moment
const carpetaDesti = selectedFolder || "GENERAL";
      await supabase.storage.from('arxiu-policial').upload(`fotos/${carpetaDesti}/${user.id}/${cleanedName}`, file, { upsert: true });
      setPendingPhotos(prev => [...new Set([...prev, file.name])]);
    }
    e.target.value = null;
  };

const sendMessage = async () => {
if (!input.trim() && pendingPhotos.length === 0) return;
const text = input; 
const photosToSend = [...pendingPhotos];
setInput(''); 
finalTranscriptRef.current = ''; 
setPendingPhotos([]); 
setIsTyping(true);

try {
// Funció que busca els fitxers de la carpeta i de les seves "mares"
const getLineageFiles = (list, targetName) => {
for (const item of list) {
// AQUESTA ÉS LA REGLA UNIVERSAL: Neteja el nom de qualsevol carpeta automàticament
const folderClean = item.name.toLowerCase().replace(/\s+/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9._-]/g, '');
if (item.name === targetName) {
const myFiles = item.files?.map(f => `${folderClean}/${user.id}/${cleanFileName(f)}`) || [];
return { found: true, files: myFiles };
}
if (item.subfolders && item.subfolders.length > 0) {
const res = getLineageFiles(item.subfolders, targetName);
if (res.found) {
const parentFiles = item.files?.map(f => `${folderClean}/${user.id}/${cleanFileName(f)}`) || [];
return { found: true, files: [...res.files, ...parentFiles] };
}
}
}
return { found: false, files: [] };
};

const result = getLineageFiles(folders, selectedFolder);
const filesPaths = [...new Set(result.files)];
const currentUnit = findFolderByName(folders, selectedFolder) || { isPhotoFolder: false };

console.log("📂 Fitxers que la IA revisarà realment:", filesPaths);

const promptFinal = `Actua com l'assistent professional X-POLICIAL V2.
ORDRE PRIORITÀRIA: Revisa els documents adjunts (${filesPaths.length} fitxers) per trobar la resposta exacta.
SI LA PREGUNTA ÉS SOBRE UN ARTICLE O NORMA: Busca literalment el text d'aquest article als documents.
SI NO HO TROBES ALS DOCUMENTS: Digues "No ho trobo als arxius interns, però segons el meu coneixement..." i respon el que sàpigues.
PREGUNTA: ${text}`;

await supabase.from('missatges').insert({ text: text, role: 'user', user_id: user.id, unitat: selectedFolder });

const res = await fetch('https://x-policial-backend.onrender.com/test_ai', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ 
pregunta: promptFinal, 
carpeta_actual: selectedFolder, 
usuari_id: user.id,
fitxers_disponibles: filesPaths,
arxius_adjunts: photosToSend.map(p => `fotos/${user.id}/${cleanFileName(p)}`),
es_unitat_fotos: currentUnit?.isPhotoFolder || false
})
});

const data = await res.json();
await supabase.from('missatges').insert({ 
text: data.ia_diu || "Sense dades.", role: 'assistant', user_id: user.id, unitat: selectedFolder, font_info: data.font || null 
});

const { data: nous } = await supabase.from('missatges').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
if (nous) setMessages(nous);
} catch (e) { 
console.error("Error IA:", e);
alert("⚠️ Error amb la IA."); 
} finally { 
setIsTyping(false); 
}
};

// El retorn de la interfície es manté igual, només hem corregit la lògica de dalt
const RenderFolder = (item, depth = 0) => {
if (!item || !item.name) return null;
const isBunker = item.id === 'BUNKER';
const keyId = isBunker ? 'BUNKER_MAIN' : (item.id || `folder_${depth}`);
if (isBunker && !userData?.nivell?.includes('5')) return null;
const hasAccess = userData?.nivell?.includes('5') || item.level?.some(l => userData?.nivell?.includes(l));
if (!hasAccess && !isBunker) return null;

return (
<div key={keyId} className="mb-0.5"> 
<div className={`flex items-center justify-between p-2 rounded-xl cursor-pointer group ${selectedFolder === (isBunker ? 'ADMINISTRACIÓ' : item.name) ? 'bg-blue-600/30 border border-blue-500/50' : 'hover:bg-slate-800 text-slate-400'}`} 
onClick={() => {
// 📚 DICCIONARI D'ENLLAÇOS A NOTEBOOK LM
const enllacosNotebook = {
"ÀMBIT GENERAL": "https://notebooklm.google.com/notebook/99c7bc92-04f1-471d-8067-50e3d1901e0f",
"ÀMBIT ADMINISTRATIU": "https://notebooklm.google.com/notebook/bc6eb287-56c5-45be-95e9-bdc40bac6ed2",
"ÀMBIT TRÀNSIT": "https://notebooklm.google.com/notebook/532092b5-36c2-4515-a63b-e9f92b4af077",
"ÀMBIT PENAL": "https://notebooklm.google.com/notebook/da48b2f1-879a-45b6-b6ff-be0d2711e6e1",
"ÀMBIT O.M BORGES BL.": "https://notebooklm.google.com/notebook/77c125ed-57e0-4a14-83e7-68699fd72307",
"ÀMBIT SEGURETAT CIUTADANA": "https://notebooklm.google.com/notebook/610ef06f-17ee-4200-8dfb-a77b57a89742",
"ÀMBIT O.M MONTBLANC": "https://notebooklm.google.com/notebook/a8fc38f5-de82-4061-85a8-2d5b5479d2a2"
};

// Si el nom de la carpeta que clico està a la llista, obre l'enllaç!
if (enllacosNotebook[item.name]) { 
window.open(enllacosNotebook[item.name], "_blank"); 
} else if (isBunker) { 
setIsGestióUsuaris(true); setSelectedFolder('ADMINISTRACIÓ'); 
} else { 
setIsGestióUsuaris(false); setSelectedFolder(item.name); toggleFolder(item.id); 
} 
}}>
<div className="flex items-center gap-3" style={{ marginLeft: `${depth * 20}px` }}>
{!isBunker && (item.isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
<Folder size={20} className={isBunker ? 'text-red-600 animate-pulse' : (item.isPhotoFolder ? 'text-sky-400' : 'text-amber-500')} />
<span className={`text-[13px] font-black uppercase tracking-tight ${isBunker ? 'text-red-500' : ''}`}>{item.name}</span>
</div>
<div className="flex gap-1.5 items-center"
>
{userData?.nivell?.includes(5) && isGestor && !isBunker && (
<div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
<Plus size={14} className="text-emerald-400" title="Afegir Subcarpeta" onClick={(e) => { e.stopPropagation(); addFolder(item.id); }} />
<Upload size={14} className="text-sky-400" title="Pujar Document" onClick={(e) => { e.stopPropagation(); fileInputRef.current.setAttribute('data-target-folder', item.id); fileInputRef.current.click(); }} />
<Trash2 size={14} className="text-red-500" title="Eliminar Carpeta" onClick={(e) => { e.stopPropagation(); deleteFolder(item.id); }} />
</div>
)}
</div>
</div>
{item.isOpen && !isBunker && (
<div className="ml-4 border-l-2 border-slate-800/50">
{item.subfolders?.map(sub => RenderFolder(sub, depth + 1))}
{isGestor && item.files?.map((f, i) => (
<div key={i} className="flex items-center justify-between p-2 ml-10 group/file">
<div className="flex items-center gap-3 text-[11px] text-slate-400 italic"><FileText size={14} /> {f}</div>
<button onClick={(e) => { e.stopPropagation(); deleteFile(item.id, f); }} className="opacity-0 group-hover/file:opacity-100 text-red-500 hover:text-red-400"><X size={14}/></button>
</div>
))}
</div>
)}
</div>
);
};

if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center text-blue-500 font-black animate-pulse uppercase">Carregant X-POLICIAL...</div>;

if (!user) {
return (
<div className="h-screen bg-[#020617] flex items-center justify-center p-4 text-white font-sans overflow-hidden">
<div className="max-w-md w-full bg-[#0f172a] border border-slate-800 rounded-[2rem] p-8 shadow-2xl relative overflow-y-auto max-h-[95vh]">
<div className="text-center mb-6"><Shield className="mx-auto text-blue-500 mb-2" size={40} /><h1 className="text-xl font-black italic uppercase">X-POLICIAL</h1></div>
<div className="space-y-4">
<div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-2xl">
<p className="text-[9px] leading-tight text-blue-300/80 text-justify uppercase font-bold">
⚠️ AVÍS: L'usuari es compromet a fer un bon ús del sistema. En cap cas els resultats obtinguts substituiran el criteri professional.
</p>
<label className="flex items-center gap-2 mt-2 cursor-pointer">
<input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 text-blue-600" />
<span className="text-[8px] font-black uppercase text-slate-500">Accepto el compromís</span>
</label>
</div>
<input type="email" placeholder="EMAIL CORPORATIU" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#1e293b] p-3 rounded-xl border border-slate-700 outline-none" />
<input type="password" placeholder="CONTRASENYA" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#1e293b] p-3 rounded-xl border border-slate-700 outline-none" />
{isRegistering && (
<>
<input type="text" placeholder="COS POLICIAL" value={cosPolicial} onChange={e => setCosPolicial(e.target.value)} className="w-full bg-[#1e293b] p-3 rounded-xl border border-slate-700 outline-none" />
<input type="text" placeholder="QUI ET RECOMANA?" value={recomanatPer} onChange={e => setRecomanatPer(e.target.value)} className="w-full bg-[#1e293b] p-3 rounded-xl border border-slate-700 outline-none" />
</>
)}
<button disabled={!acceptTerms} onClick={async () => {
if (isRegistering) {
const { data, error } = await supabase.auth.signUp({ email, password });
if (data?.user) {
await supabase.from('usuaris').insert({ id: data.user.id, email, estat: 'PENDENT', nivell: [1], cos_policial: cosPolicial, recomanat_per: recomanatPer });
alert("✅ SOL·LICITUD ENVIADA."); setIsRegistering(false);
} else alert("Error: " + error.message);
} else {
const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) alert("Error d'accés: " + error.message);
}
}} className={`w-full py-3 rounded-xl font-black uppercase tracking-widest ${acceptTerms ? 'bg-blue-600' : 'bg-slate-800 opacity-50'}`}>{isRegistering ? "Sol·licitar" : "Accedir"}</button>
<button onClick={() => setIsRegistering(!isRegistering)} className="w-full text-[9px] text-slate-500 font-black uppercase underline">{isRegistering ? "Tornar" : "Vull registrar-me"}</button>
</div>
</div>
</div>
);
}

const currentFolderData = findFolderByName(folders, selectedFolder);
const isRedaccio = checkInheritance(folders, selectedFolder, "REDACCIÓ DE DOCUMENTS");

return (
<div className="flex h-screen bg-[#020617] text-white overflow-hidden font-sans">
<input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileUpload(e, fileInputRef.current.getAttribute('data-target-folder'))} />
<input type="file" ref={photoInputRef} multiple accept="image/*" className="hidden" onChange={handlePhotoUploadChat} />
<div className={`
w-[420px] bg-[#0f172a] border-r border-slate-800 flex flex-col shrink-0 z-10
md:block
${mobileView === "chat" ? "hidden md:block" : "flex"}
`}>
<div className="p-8 border-b border-slate-800 flex items-center justify-between">
<div className="flex items-center gap-3 font-black text-2xl italic text-blue-500"><Shield size={28}/> X-POLICIAL</div>
<div className="flex gap-2">
{userData?.nivell?.includes(5) && (
<button onClick={() => setIsGestor(!isGestor)} className={`p-2.5 rounded-xl transition-all ${isGestor ? 'bg-red-600 shadow-lg' : 'bg-slate-800 text-slate-500'}`} title="Mode Admin"><Settings size={20}/></button>
)}
<button onClick={() => supabase.auth.signOut()} className="p-2.5 bg-slate-800 rounded-xl text-slate-500 hover:text-red-500"><LogOut size={20}/></button>
</div>
</div>
<div className="flex-1 overflow-y-auto p-6 space-y-2">

{/* BUNKER ADMINISTRACIÓ */}
<div className="mb-2">
{RenderFolder({ id: 'BUNKER', name: 'ADMINISTRACIÓ', level: [5] })}

{userData?.nivell?.includes(5) && isGestor && (
<div className="text-[12px] text-red-400 italic p-2 bg-red-900/30 rounded-xl border border-red-500/50 mt-2">
MODE ADMIN ACTIU
</div>
)}
</div>

{/* 👥 GESTIÓ USUARIS + CREAR CARPETA (NOMÉS ADMIN + MODE GESTOR) */}
{userData?.nivell?.includes(5) && isGestor && (
<>
{/* GESTIÓ USUARIS */}
<div className="mb-3 flex items-center justify-between px-3 py-2 bg-slate-900/40 border border-slate-800 rounded-xl">
<div className="flex items-center gap-2">
<Shield size={16} className="text-emerald-400"/>
<span className="text-[11px] uppercase font-bold text-emerald-300">
Gestió usuaris
</span>
</div>

<button
onClick={() => {
setIsGestióUsuaris(true);
setSelectedFolder('USUARIS');
setMobileView("chat");
}}
className="text-[10px] px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 font-bold"
>
TAULA
</button>
</div>

{/* CREAR CARPETA */}
<button
onClick={() => addFolder(null)}
className="w-full p-3 bg-emerald-600/40 hover:bg-emerald-600 border border-emerald-500/60 rounded-xl text-emerald-300 font-black uppercase shadow-lg text-sm tracking-widest mb-3"
>
<FolderPlus size={18} className="inline mr-2" />
CREAR CARPETA MARE
</button>

<div className="h-px bg-slate-800/50 my-3"></div>
</>
)}

{/* 📁 RENDER REAL DE CARPETES */}
{folders.map(f => RenderFolder(f))}

</div>
</div>

<div className={`
flex-1 flex flex-col
${mobileView === "folders" ? "hidden md:flex" : "flex"}
`}>
<header className="h-20 border-b border-slate-800 flex items-center px-10 justify-between bg-[#0f172a]/20">
<span className="text-xs font-black uppercase text-blue-400 italic tracking-widest">{selectedFolder}<button
className="md:hidden text-xs text-blue-400 font-black mr-3"
onClick={() => setMobileView("folders")}
>
← CARPETES
</button></span>
{!isGestióUsuaris && <button onClick={async () => { if(confirm("Buidar xat?")) { await supabase.from('missatges').delete().eq('unitat', selectedFolder).eq('user_id', user.id); setMessages([]); } }} className="text-[10px] text-slate-600 hover:text-red-400 uppercase font-black flex items-center gap-2"><Eraser size={14}/> Buidar</button>}
</header>

<main ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-6">
{isGestióUsuaris ? (
<div className="bg-[#0f172a] border border-slate-800 rounded-[2rem] overflow-x-auto shadow-2xl w-full">
<table className="min-w-[700px] w-full text-[11px] text-left text-slate-300">
<thead className="bg-slate-800/50 text-slate-500 uppercase font-black">
<tr><th className="p-5">Agent</th><th className="p-5 text-center">Nivells</th><th className="p-5 text-center">Estat</th><th className="p-5 text-right">Accions</th></tr>
</thead>
<tbody>
{allUsers.map(u => (
<tr key={u.id} className="border-b border-slate-800/50 hover:bg-white/5">
<td className="p-5 font-bold uppercase">{u.email} <br/><span className="text-[9px] text-blue-500 font-black">{u.cos_policial} | REC: {u.recomanat_per}</span></td>
<td className="p-5 flex justify-center gap-1">
{[1,2,3,4,5].map(n => (
<button key={n} onClick={async () => { 
const ns = u.nivell?.includes(n) ? u.nivell.filter(v=>v!==n) : [...(u.nivell||[]), n]; 
await supabase.from('usuaris').update({ nivell: ns }).eq('id', u.id);
setAllUsers(allUsers.map(usr => usr.id === u.id ? {...usr, nivell: ns} : usr));
}} className={`w-7 h-7 rounded-lg font-black ${u.nivell?.includes(n) ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-500'}`}>{n}</button>
))}
</td>
<td className="p-5 text-center font-black text-[9px]">{u.estat}</td>
<td className="p-5 text-right flex justify-end gap-2">
{u.estat !== 'ACTIU' && <button onClick={async () => { await supabase.from('usuaris').update({ estat: 'ACTIU' }).eq('id', u.id); setAllUsers(allUsers.map(usr => usr.id === u.id ? {...usr, estat: 'ACTIU'} : usr)); }} title="Activar" className="p-2 bg-emerald-600/20 text-emerald-500 rounded-xl"><UserPlus size={16}/></button>}
<button onClick={async () => { if(confirm("Eliminar Agent?")) { await supabase.from('usuaris').delete().eq('id', u.id); setAllUsers(allUsers.filter(usr => usr.id !== u.id)); } }} className="p-2 bg-slate-700 text-slate-400 rounded-xl hover:bg-red-600"><Trash2 size={16}/></button>
</td>
</tr>
))}
</tbody>
</table>
</div>
) : (
messages.filter(m => m.unitat === selectedFolder).map((m, i) => (
<div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
<div className="flex flex-col gap-2 max-w-2xl">
<div className={`p-5 rounded-[1.5rem] text-[14px] leading-relaxed shadow-lg ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-[#1e293b] border border-slate-700 text-white'}`}>
{m.role === 'assistant' ? (
<div className="prose prose-invert max-w-none text-white text-[14px] leading-relaxed">
<ReactMarkdown>
{m.text}
</ReactMarkdown>
</div>
) : (
<div className="whitespace-pre-wrap">{m.text}</div>
)}
</div>
{m.role === 'assistant' && m.font_info && (
<div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/50 rounded-lg text-[10px] text-blue-400 font-black italic border border-blue-500/10 self-start"><BookOpen size={12}/> FONT: {m.font_info}</div>
)}
{m.role === 'assistant' && isRedaccio && (
<button onClick={() => descarregarActaWord(m.text)} className="self-start flex items-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all border border-blue-500/20 mt-1"><Download size={14}/> Generar Acta .DOCX</button>
)}
</div>
</div>
))
)}
{isTyping && <div className="text-blue-400 text-[10px] animate-pulse uppercase font-black italic">Consultant intel·ligència policial...</div>} 
</main>

{!isGestióUsuaris && (
<footer className="p-10">
<div className="max-w-4xl mx-auto flex gap-4 bg-[#1e293b] p-4 rounded-[2rem] border border-slate-700 items-end shadow-2xl relative">
{currentFolderData?.isPhotoFolder && (
<button onClick={() => photoInputRef.current.click()} className="p-4 bg-slate-700 text-sky-400 rounded-2xl hover:bg-slate-600 transition-colors relative">
<ImageIcon size={24}/>
{pendingPhotos.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-black">{pendingPhotos.length}</span>}
</button>
)}
<button onClick={() => { 
if (isListening) { recognitionRef.current.stop(); setIsListening(false); } 
else {
const sr = window.SpeechRecognition || window.webkitSpeechRecognition;
recognitionRef.current = new sr(); recognitionRef.current.lang = 'ca-ES'; recognitionRef.current.continuous = true; recognitionRef.current.interimResults = true;
recognitionRef.current.onresult = (e) => {
let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) finalTranscriptRef.current += e.results[i][0].transcript + ' '; else interim += e.results[i][0].transcript; }
setInput(finalTranscriptRef.current + interim);
};
recognitionRef.current.start(); setIsListening(true);
}
}} className={`p-4 rounded-2xl transition-all ${isListening ? 'bg-red-600 animate-pulse text-white' : 'bg-slate-700 text-slate-400'}`}><Mic size={24}/></button>
<textarea value={input} 
onChange={e => { setInput(e.target.value); finalTranscriptRef.current = e.target.value; }} 
onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
placeholder="Dicti o escrigui el resum de l'actuació..." className="flex-1 bg-transparent outline-none text-[15px] resize-none min-h-[44px] py-3 text-white" />
<button onClick={sendMessage} className="bg-blue-600 p-4 rounded-2xl hover:bg-blue-500 shadow-lg text-white transition-colors"><Send size={24}/></button>
</div>
</footer>
)}
</div>
</div>
);
}

export default App;


