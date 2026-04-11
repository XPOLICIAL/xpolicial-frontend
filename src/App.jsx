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

/* 📱 IMPORTANT: nou sistema de navegació mobile */
const [viewMode, setViewMode] = useState("folders");

const cleanFileName = (name) => {
if (!name) return "";
return name.toLowerCase()
.replace(/\s+/g, '_')
.normalize("NFD")
.replace(/[\u0300-\u036f]/g, "")
.replace(/[^a-z0-9._-]/g, '');
};
useEffect(() => {
supabase.auth.getSession().then(({ data: { session } }) => {
handleUserChange(session?.user ?? null);
});

const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
handleUserChange(session?.user ?? null);
});

return () => subscription.unsubscribe();
}, []);

const handleUserChange = async (authUser) => {
if (authUser) {
const { data } = await supabase
.from('usuaris')
.select('*')
.eq('id', authUser.id)
.maybeSingle();

if (data && data.estat === 'ACTIU') {
setUser(authUser);
setUserData(data);
} else {
await supabase.auth.signOut();
setUser(null);
setUserData(null);
}
} else {
setUser(null);
setUserData(null);
}
setLoading(false);
};

useEffect(() => {
if (!user) return;

const fetchConfig = async () => {
const { data } = await supabase
.from('configuracio')
.select('estructura')
.eq('id', 'sidebar')
.maybeSingle();

if (data?.estructura) {
const llista = data.estructura.folders || data.estructura;
setFolders(Array.isArray(llista) ? llista : []);
}
};

const fetchMessages = async () => {
const { data } = await supabase
.from('missatges')
.select('*')
.eq('user_id', user.id)
.order('created_at', { ascending: true });

if (data) setMessages(data);
};

fetchConfig();
fetchMessages();

if (userData?.nivell?.includes(5)) {
const fetchUsers = async () => {
const { data } = await supabase.from('usuaris').select('*');
if (data) setAllUsers(data);
};
fetchUsers();
}
}, [user, userData]);

/* =========================
   FILE UPLOAD
========================= */

const handleFileUpload = async (e) => {
const file = e.target.files[0];
if (!file) return;

const cleanedName = cleanFileName(file.name);
const carpetaDesti = selectedFolder || "GENERAL";

const formData = new FormData();
formData.append("file", file, cleanedName);
formData.append("carpeta_actual", carpetaDesti);

try {
await fetch('https://x-policial-backend.onrender.com/pujar_document', {
method: 'POST',
body: formData
});

const updateFolders = (list) =>
list.map(f => {
if (f.name === carpetaDesti) {
return {
...f,
files: [...(f.files || []), file.name]
};
}
if (f.subfolders) {
return {...f, subfolders: updateFolders(f.subfolders)};
}
return f;
});

setFolders(updateFolders(folders));

} catch (err) {
console.error(err);
}
};

/* =========================
   DELETE FILE
========================= */

const deleteFile = async (folderId, fileName) => {
const formData = new FormData();
formData.append("file_path", fileName);
formData.append("carpeta", selectedFolder || "GENERAL");

await fetch('https://x-policial-backend.onrender.com/esborrar_document', {
method: 'POST',
body: formData
});

const updateFolders = (list) =>
list.map(f => {
if (f.id === folderId) {
return {
...f,
files: (f.files || []).filter(x => x !== fileName)
};
}
if (f.subfolders) {
return {...f, subfolders: updateFolders(f.subfolders)};
}
return f;
});

setFolders(updateFolders(folders));
};

/* =========================
   SEND MESSAGE (IA)
========================= */

const sendMessage = async () => {
if (!input.trim() && pendingPhotos.length === 0) return;

const text = input;
setInput('');
setPendingPhotos([]);
setIsTyping(true);

try {
await supabase.from('missatges').insert({
text,
role: 'user',
user_id: user.id,
unitat: selectedFolder
});

const res = await fetch('https://x-policial-backend.onrender.com/test_ai', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
pregunta: text,
carpeta_actual: selectedFolder,
usuari_id: user.id
})
});

const data = await res.json();

await supabase.from('missatges').insert({
text: data.ia_diu || "Sense resposta",
role: 'assistant',
user_id: user.id,
unitat: selectedFolder
});

const { data: nous } = await supabase
.from('missatges')
.select('*')
.eq('user_id', user.id)
.order('created_at', { ascending: true });

if (nous) setMessages(nous);

} catch (err) {
console.error(err);
} finally {
setIsTyping(false);
}
};
const findFolderByName = (list, name) => {
for (const item of list) {
if (item.name === name) return item;
if (item.subfolders) {
const found = findFolderByName(item.subfolders, name);
if (found) return found;
}
}
return null;
};

const loadingUI = () => {
return (
<div className="h-screen bg-[#020617] flex items-center justify-center text-blue-500 font-black">
Carregant X-POLICIAL...
</div>
);
};

const loginUI = () => {
return (
<div className="h-screen bg-[#020617] flex items-center justify-center text-white">
<div className="p-10 bg-[#0f172a] border border-slate-800 rounded-2xl">
<h1 className="text-xl font-black mb-4">X-POLICIAL</h1>

<input
className="w-full mb-2 p-2 bg-slate-800 rounded"
placeholder="email"
value={email}
onChange={e => setEmail(e.target.value)}
/>

<input
className="w-full mb-4 p-2 bg-slate-800 rounded"
placeholder="password"
type="password"
value={password}
onChange={e => setPassword(e.target.value)}
/>

<button
className="w-full bg-blue-600 p-2 rounded font-black"
onClick={async () => {
const { error } = await supabase.auth.signInWithPassword({
email,
password
});
if (error) alert(error.message);
}}
>
ENTRAR
</button>
</div>
</div>
);
};

const RenderFolder = (item, depth = 0) => {
if (!item) return null;

const hasAccess =
userData?.nivell?.includes(5) ||
item.level?.some(l => userData?.nivell?.includes(l));

if (!hasAccess) return null;

return (
<div key={item.id} className="mb-1">

<div
className={`flex items-center justify-between p-2 cursor-pointer rounded-xl ${
selectedFolder === item.name ? "bg-blue-600/30" : "hover:bg-slate-800"
}`}
onClick={() => {
setSelectedFolder(item.name);
setViewMode("chat"); // 📱 CLAU WHATSAPP
}}
>
<div className="flex items-center gap-2" style={{ marginLeft: depth * 16 }}>
{item.isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
<Folder size={18} className="text-amber-500"/>
<span className="text-xs font-black uppercase">
{item.name}
</span>
</div>
</div>

{item.subfolders?.length > 0 && (
<div className="ml-4 border-l border-slate-700 pl-2">
{item.subfolders.map(sub => RenderFolder(sub, depth + 1))}
</div>
)}

{item.isOpen && item.files?.length > 0 && (
<div className="ml-6 mt-1 space-y-1">
{item.files.map((f, i) => (
<div key={i} className="text-[10px] text-slate-400 flex justify-between">
<span>📄 {f}</span>
<button
onClick={() => deleteFile(item.id, f)}
className="text-red-500"
>
X
</button>
</div>
))}
</div>
)}
</div>
);
};
if (loading) return loadingUI();
if (!user) return loginUI();

const currentFolderData = findFolderByName(folders, selectedFolder);

return (
<div className="h-screen bg-[#020617] text-white overflow-hidden md:flex">

{/* =========================
   SIDEBAR
========================= */}
<div className={`w-[420px] bg-[#0f172a] border-r border-slate-800 flex flex-col shrink-0
${viewMode === "chat" ? "hidden md:flex" : "flex"}`}>

{/* HEADER SIDEBAR */}
<div className="p-6 border-b border-slate-800 flex items-center justify-between">
<div className="flex items-center gap-2 font-black text-blue-500">
<Shield size={10}/> X-POLICIAL
</div>

<button
className="text-xs bg-slate-800 px-3 py-1 rounded"
onClick={() => supabase.auth.signOut()}
>
SORTIR
</button>
</div>

{/* FOLDERS */}
<div className="flex-1 overflow-y-auto p-4 space-y-2">
{folders.map(f => RenderFolder(f))}
</div>
</div>

{/* =========================
   CHAT / CONTENT
========================= */}
<div className={`flex-1 flex flex-col
${viewMode === "folders" ? "hidden md:flex" : "flex"}`}>

{/* HEADER CHAT */}
<div className="h-16 border-b border-slate-800 flex items-center justify-between px-4">
<div className="flex items-center gap-2">
{/* BACK BUTTON MOBILE */}
<button
className="md:hidden text-xs bg-slate-800 px-2 py-1 rounded"
onClick={() => setViewMode("folders")}
>
←
</button>

<span className="font-black text-xs uppercase text-blue-400">
{selectedFolder}
</span>
</div>

<button
className="text-[10px] text-red-400"
onClick={() => setMessages([])}
>
Netejar
</button>
</div>

{/* MESSAGES */}
<main className="flex-1 overflow-y-auto p-4 space-y-3">

{messages
.filter(m => m.unitat === selectedFolder)
.map((m, i) => (
<div
key={i}
className={`max-w-[80%] p-3 rounded-xl text-sm ${
m.role === "user"
? "ml-auto bg-blue-600"
: "bg-slate-800"
}`}
>
{m.text}
</div>
))}

{isTyping && (
<div className="text-xs text-blue-400 animate-pulse">
Escrivint...
</div>
)}

</main>

{/* INPUT */}
<div className="p-3 border-t border-slate-800 flex gap-2">

<textarea
value={input}
onChange={e => setInput(e.target.value)}
className="flex-1 bg-slate-800 p-2 rounded text-sm"
placeholder="Escriu missatge..."
/>

<button
onClick={sendMessage}
className="bg-blue-600 px-4 rounded font-black"
>
➤
</button>

</div>
</div>
</div>
);
