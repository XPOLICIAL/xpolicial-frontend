import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from "./supabaseClient";
import { 
  Shield, Settings, Folder, FolderPlus, Plus, Trash2, Send, 
  ChevronRight, ChevronDown, ChevronLeft, FileText, Upload, X, Mic, 
  Eraser, LogOut, UserPlus, Download, BookOpen, Image as ImageIcon 
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// --- UTILITATS ---
const cleanFileName = (name) => {
  if (!name) return "";
  return name.toLowerCase().replace(/\s+/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9._-]/g, '');
};

// --- COMPONENT DE CARPETA RECURSIU (A FORA PER EVITAR RE-RENDERS I PÈRDUA DE FOCUS) ---
const FolderItem = ({ 
  item, depth = 0, userData, isGestor, selectedFolder, onSelectFolder, onToggle, 
  onAddSub, onUpload, onDeleteFolder, onDeleteFile, setMobileView, setIsGestióUsuaris
}) => {
  if (!item || !item.name) return null;
  
  // Filtre d'accés
  const hasAccess = userData?.nivell?.includes(5) || item.level?.some(l => userData?.nivell?.includes(l));
  if (!hasAccess) return null;

  const isSelected = selectedFolder === item.name;

  const handleFolderClick = () => {
    const enllacosNotebook = {
      "ÀMBIT GENERAL": "https://notebooklm.google.com/notebook/99c7bc92-04f1-471d-8067-50e3d1901e0f",
      "ÀMBIT ADMINISTRATIU": "https://notebooklm.google.com/notebook/bc6eb287-56c5-45be-95e9-bdc40bac6ed2",
      "ÀMBIT TRÀNSIT": "https://notebooklm.google.com/notebook/532092b5-36c2-4515-a63b-e9f92b4af077",
      "ÀMBIT PENAL": "https://notebooklm.google.com/notebook/da48b2f1-879a-45b6-b6ff-be0d2711e6e1",
      "ÀMBIT O.M BORGES BL.": "https://notebooklm.google.com/notebook/77c125ed-57e0-4a14-83e7-68699fd72307",
      "ÀMBIT SEGURETAT CIUTADANA": "https://notebooklm.google.com/notebook/610ef06f-17ee-4200-8dfb-a77b57a89742",
      "ÀMBIT O.M MONTBLANC": "https://notebooklm.google.com/notebook/a8fc38f5-de82-4061-85a8-2d5b5479d2a2"
    };

    if (enllacosNotebook[item.name]) {
      window.open(enllacosNotebook[item.name], "_blank");
    } else {
      setIsGestióUsuaris(false);
      onSelectFolder(item.name);
      if (!item.subfolders || item.subfolders.length === 0) setMobileView("chat");
    }
  };

  return (
    <div className="mb-0.5">
      <div 
        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer group transition-all ${isSelected ? 'bg-blue-600/30 border border-blue-500/50' : 'hover:bg-slate-800 text-slate-400'}`}
        onClick={handleFolderClick}
      >
        <div className="flex items-center gap-3" style={{ marginLeft: `${depth * 15}px` }}>
          <span className="hover:text-white" onClick={(e) => { e.stopPropagation(); onToggle(item.id); }}>
            {(item.subfolders?.length > 0 || item.files?.length > 0) ? (item.isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16}/>) : <div className="w-4" />}
          </span>
          <Folder size={18} className={item.isPhotoFolder ? 'text-sky-400' : 'text-amber-500'} />
          <span className="text-[13px] font-black uppercase tracking-tight text-slate-200">{item.name}</span>
        </div>
        {userData?.nivell?.includes(5) && isGestor && (
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Plus size={14} className="text-emerald-400" onClick={(e) => { e.stopPropagation(); onAddSub(item.id); }} />
            <Upload size={14} className="text-sky-400" onClick={(e) => { e.stopPropagation(); onUpload(item.id); }} />
            <Trash2 size={14} className="text-red-500" onClick={(e) => { e.stopPropagation(); onDeleteFolder(item.id); }} />
          </div>
        )}
      </div>
      {item.isOpen && (
        <div className="ml-2 border-l border-slate-800/50">
          {item.subfolders?.map(sub => <FolderItem key={sub.id} item={sub} depth={depth + 1} userData={userData} isGestor={isGestor} selectedFolder={selectedFolder} onSelectFolder={onSelectFolder} onToggle={onToggle} onAddSub={onAddSub} onUpload={onUpload} onDeleteFolder={onDeleteFolder} onDeleteFile={onDeleteFile} setMobileView={setMobileView} setIsGestióUsuaris={setIsGestióUsuaris} />)}
          {item.files?.map((f, i) => (
            <div key={i} className="flex items-center justify-between p-2 ml-8 group/file hover:bg-slate-800/30 rounded-lg text-[11px] text-slate-500 italic">
              <div className="flex items-center gap-3"><FileText size={12} /> {f}</div>
              {isGestor && <X size={14} className="opacity-0 group-hover/file:opacity-100 text-red-500 cursor-pointer" onClick={(e) => { e.stopPropagation(); onDeleteFile(item.id, f); }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- COMPONENT PRINCIPAL ---
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
  const [mobileView, setMobileView] = useState("folders");

  const recognitionRef = useRef(null);
  const manualStopRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  // Auth & Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { handleUserChange(session?.user ?? null); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { handleUserChange(session?.user ?? null); });
    return () => subscription.unsubscribe();
  }, []);

  const handleUserChange = async (authUser) => {
    if (authUser) {
      const { data } = await supabase.from('usuaris').select('*').eq('id', authUser.id).maybeSingle();
      if (data && data.estat === 'ACTIU') { 
        setUser(authUser); 
        setUserData(data); 
      } else if (data) { 
        alert(data.estat === 'BLOQUEJAT' ? "❌ ACCÉS BLOQUEJAT" : "⚠️ PENDENT D'ACTIVACIÓ"); 
        await supabase.auth.signOut(); 
      } else { 
        setUser(null); 
        setUserData(null); 
      }
    } else { 
      setUser(null); 
      setUserData(null); 
    }
    setLoading(false);
  };

  // Carregar Dades Inicials
  useEffect(() => {
    if (!user) return;
    const fetchConfig = async () => {
      const { data } = await supabase.from('configuracio').select('estructura').eq('id', 'sidebar').maybeSingle();
      if (data?.estructura) { 
        const llista = data.estructura.folders || data.estructura; 
        setFolders(Array.isArray(llista) ? llista : []); 
      }
    };
    const fetchMessages = async () => {
      const { data } = await supabase.from('missatges').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
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

  const syncFolders = async (nova) => { 
    setFolders(nova);
    await supabase.from('configuracio').upsert({ id: 'sidebar', estructura: { folders: nova } }); 
  };

  // --- RECONEIXEMENT DE VEU ---
  const startRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("El dictat no és compatible amb aquest navegador.");
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = 'ca-ES'; rec.continuous = true; rec.interimResults = true;
    rec.onstart = () => setIsListening(true);
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscriptRef.current += t + ' ';
        else interim += t;
      }
      setInput(finalTranscriptRef.current + interim);
    };
    rec.onend = () => { if (!manualStopRef.current) { try { rec.start(); } catch(e) {} } else setIsListening(false); };
    rec.start();
  }, []);

  const toggleMic = () => {
    if (isListening) { manualStopRef.current = true; recognitionRef.current?.stop(); }
    else { manualStopRef.current = false; startRecognition(); }
  };

  // --- GESTIÓ DE FITXERS ---
  const handleFileUpload = async (e, folderId) => {
    const file = e.target.files[0]; if (!file) return;
    const cleaned = cleanFileName(file.name);
    try {
      const formData = new FormData();
      formData.append("file", file, cleaned);
      formData.append("carpeta_actual", selectedFolder || "GENERAL");
      const res = await fetch('https://x-policial-backend.onrender.com/pujar_document', { method: 'POST', body: formData });
      if (!res.ok) throw new Error("Error backend");
      
      const update = (list) => list.map(f => {
        if (f.name === selectedFolder || f.id === parseInt(folderId)) {
          return { ...f, files: [...new Set([...(f.files || []), file.name])], hasFiles: true };
        }
        if (f.subfolders) return { ...f, subfolders: update(f.subfolders) };
        return f;
      });
      syncFolders(update(folders));
      alert("✅ Fitxer pujat!");
    } catch (err) { alert("❌ Error en la pujada."); }
    e.target.value = null;
  };

  const deleteFile = async (folderId, fileName) => {
    if (!confirm("Vols eliminar el document?")) return;
    try {
      const formData = new FormData();
      formData.append("file_path", fileName);
      formData.append("carpeta", selectedFolder || "GENERAL");
      await fetch('https://x-policial-backend.onrender.com/esborrar_document', { method: 'POST', body: formData });
      
      const update = (list) => list.map(i => 
        i.id === folderId 
        ? { ...i, files: i.files.filter(f => f !== fileName) } 
        : { ...i, subfolders: update(i.subfolders || []) }
      );
      syncFolders(update(folders));
    } catch (e) { alert("❌ Error en esborrar."); }
  };

  const addFolder = (parentId = null) => {
    const name = prompt("NOM DE LA CARPETA:"); if (!name) return;
    const levelInput = prompt("ACCÉS (1,2,3,4,5):", "1");
    const esFoto = confirm("📊 ÉS CARPETA DE FOTOS?");
    const levels = levelInput.split(',').map(n => parseInt(n.trim()));
    const newObj = { id: Date.now(), name: name.toUpperCase(), level: levels, isOpen: true, files: [], subfolders: [], isPhotoFolder: esFoto };
    
    const update = (list) => {
      if (!parentId) return [...list, newObj];
      return list.map(i => i.id === parentId ? {...i, isOpen: true, subfolders: [...(i.subfolders || []), newObj]} : {...i, subfolders: update(i.subfolders || [])});
    };
    syncFolders(update(folders));
  };

  const deleteFolder = (id) => {
    if (!confirm("Eliminar carpeta i contingut?")) return;
    const update = (list) => list.filter(i => i.id !== id).map(i => ({...i, subfolders: update(i.subfolders || [])}));
    syncFolders(update(folders));
  };

  const toggleFolder = (id) => {
    const update = (list) => list.map(i => i.id === id ? {...i, isOpen: !i.isOpen} : {...i, subfolders: update(i.subfolders || [])});
    setFolders(update(folders));
  };

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
      const a = document.createElement('a'); a.href = url; a.download = `ACTA_${selectedFolder}.docx`; a.click();
    } catch (e) { alert("❌ Error en generar Word."); }
  };

  // --- MISSATGERIA ---
  const sendMessage = async () => {
    if (!input.trim() && pendingPhotos.length === 0) return;
    const text = input; const photos = [...pendingPhotos];
    setInput(''); finalTranscriptRef.current = ''; setPendingPhotos([]); setIsTyping(true);

    try {
      const getLineageFiles = (list, target) => {
        for (const i of list) {
          const cleanName = cleanFileName(i.name);
          if (i.name === target) return { found: true, files: i.files?.map(f => `${cleanName}/${user.id}/${cleanFileName(f)}`) || [] };
          if (i.subfolders) {
            const res = getLineageFiles(i.subfolders, target);
            if (res.found) return { found: true, files: [...res.files, ...(i.files?.map(f => `${cleanName}/${user.id}/${cleanFileName(f)}`) || [])] };
          }
        }
        return { found: false, files: [] };
      };
      
      const resFiles = getLineageFiles(folders, selectedFolder);
      const findCurrent = (list, name) => {
        for (const i of list) {
          if (i.name === name) return i;
          if (i.subfolders) { const f = findCurrent(i.subfolders, name); if (f) return f; }
        }
        return null;
      };
      const currentUnit = findCurrent(folders, selectedFolder);

      await supabase.from('missatges').insert({ text, role: 'user', user_id: user.id, unitat: selectedFolder });

      const res = await fetch('https://x-policial-backend.onrender.com/test_ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pregunta: text, carpeta_actual: selectedFolder, usuari_id: user.id,
          fitxers_disponibles: resFiles.files,
          arxius_adjunts: photos.map(p => `fotos/${user.id}/${cleanFileName(p)}`),
          es_unitat_fotos: currentUnit?.isPhotoFolder || false
        })
      });

      const data = await res.json();
      await supabase.from('missatges').insert({ 
        text: data.ia_diu || "Sense dades.", role: 'assistant', user_id: user.id, unitat: selectedFolder, font_info: data.font || null 
      });

      const { data: nous } = await supabase.from('missatges').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
      if (nous) setMessages(nous);
    } catch (e) { alert("⚠️ Error IA"); }
    setIsTyping(false);
  };

  const isRedaccio = useMemo(() => {
    const check = (list, target, parent = "REDACCIÓ DE DOCUMENTS") => {
      for (const i of list) {
        if (i.name === parent) {
          const deep = (sub) => sub.some(s => s.name === target || (s.subfolders && deep(s.subfolders)));
          if (i.name === target || (i.subfolders && deep(i.subfolders))) return true;
        }
        if (i.subfolders && check(i.subfolders, target, parent)) return true;
      }
      return false;
    };
    return check(folders, selectedFolder);
  }, [folders, selectedFolder]);

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center text-blue-500 font-black animate-pulse uppercase">Carregant X-Policial...</div>;

  if (!user) {
    return (
      <div className="h-screen bg-[#020617] flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-[#0f172a] border border-slate-800 rounded-[2rem] p-8 shadow-2xl">
          <div className="text-center mb-6"><Shield className="mx-auto text-blue-500 mb-2" size={40} /><h1 className="text-xl font-black uppercase tracking-tighter">X-POLICIAL</h1></div>
          <div className="space-y-4">
            <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-2xl text-[10px] text-blue-300">
              ⚠️ ÚS CORPORATIU: Les dades i consultes es registren per a fins professionals.
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} className="rounded border-slate-700 bg-slate-800 text-blue-600" />
                <span className="font-black uppercase">Accepto el compromís</span>
              </label>
            </div>
            <input type="email" placeholder="EMAIL" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#1e293b] p-3 rounded-xl border border-slate-700" />
            <input type="password" placeholder="PASSWORD" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#1e293b] p-3 rounded-xl border border-slate-700" />
            {isRegistering && (
              <>
                <input type="text" placeholder="COS POLICIAL" value={cosPolicial} onChange={e => setCosPolicial(e.target.value)} className="w-full bg-[#1e293b] p-3 rounded-xl border border-slate-700" />
                <input type="text" placeholder="RECOMANAT PER" value={recomanatPer} onChange={e => setRecomanatPer(e.target.value)} className="w-full bg-[#1e293b] p-3 rounded-xl border border-slate-700" />
              </>
            )}
            <button disabled={!acceptTerms} onClick={async () => {
              if (isRegistering) {
                const { data, error } = await supabase.auth.signUp({ email, password });
                if (data?.user) {
                  await supabase.from('usuaris').insert({ id: data.user.id, email, estat: 'PENDENT', nivell: [1], cos_policial: cosPolicial, recomanat_per: recomanatPer });
                  alert("✅ SOL·LICITUD ENVIADA."); setIsRegistering(false);
                } else alert(error.message);
              } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) alert(error.message);
              }
            }} className={`w-full py-3 rounded-xl font-black uppercase ${acceptTerms ? 'bg-blue-600' : 'bg-slate-800 opacity-50'}`}>{isRegistering ? "Sol·licitar" : "Accedir"}</button>
            <button onClick={() => setIsRegistering(!isRegistering)} className="w-full text-[10px] text-slate-500 font-black underline uppercase">{isRegistering ? "Tornar" : "Vull registrar-me"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#020617] text-white overflow-hidden">
      {/* Inputs ocults */}
      <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileUpload(e, fileInputRef.current.getAttribute('data-folder-id'))} />
      <input type="file" ref={photoInputRef} multiple accept="image/*" className="hidden" onChange={async (e) => {
          const files = Array.from(e.target.files);
          for (const file of files) {
            const cleaned = cleanFileName(file.name);
            await supabase.storage.from('arxiu-policial').upload(`fotos/${selectedFolder}/${user.id}/${cleaned}`, file, { upsert: true });
            setPendingPhotos(p => [...new Set([...p, file.name])]);
          }
          e.target.value = null;
      }} />

      {/* SIDEBAR NETEJAT */}
      <aside className={`w-[350px] bg-[#0f172a] border-r border-slate-800 flex flex-col shrink-0 z-20 ${mobileView === "chat" ? "hidden md:flex" : "flex"}`}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-xl italic text-blue-500"><Shield size={24}/> X-POLICIAL</div>
          <div className="flex gap-2">
            {userData?.nivell?.includes(5) && <button onClick={() => setIsGestor(!isGestor)} className={`p-2 rounded-lg ${isGestor ? 'bg-red-600' : 'bg-slate-800 text-slate-500'}`}><Settings size={18}/></button>}
            <button onClick={() => supabase.auth.signOut()} className="p-2 bg-slate-800 rounded-lg hover:text-red-500"><LogOut size={18}/></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {userData?.nivell?.includes(5) && isGestor && (
            <div className="mb-4 p-3 bg-slate-900/50 border border-slate-800 rounded-xl space-y-2">
              <button onClick={() => { setIsGestióUsuaris(true); setSelectedFolder('USUARIS'); setMobileView("chat"); }} className="w-full py-2 bg-blue-600/20 text-blue-400 rounded-lg text-[10px] font-bold uppercase tracking-widest"><UserPlus size={14} className="inline mr-2"/>Gestiò Usuaris</button>
              <button onClick={() => addFolder(null)} className="w-full py-2 bg-emerald-600/20 text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-widest"><FolderPlus size={14} className="inline mr-2"/>Nova Carpeta Mare</button>
            </div>
          )}
          {/* Només pintem les carpetes de la base de dades, sense duplicats manuals */}
          {folders.map(f => (
            <FolderItem key={f.id} item={f} userData={userData} isGestor={isGestor} selectedFolder={selectedFolder} onSelectFolder={setSelectedFolder} onToggle={toggleFolder} onAddSub={addFolder} onUpload={(id) => { fileInputRef.current.setAttribute('data-folder-id', id); fileInputRef.current.click(); }} onDeleteFolder={deleteFolder} onDeleteFile={deleteFile} setMobileView={setMobileView} setIsGestióUsuaris={setIsGestióUsuaris} />
          ))}
        </div>
      </aside>

      {/* MAIN */}
      <main className={`flex-1 flex flex-col ${mobileView === "folders" ? "hidden md:flex" : "flex"}`}>
        <header className="h-16 border-b border-slate-800 flex items-center px-6 justify-between bg-[#0f172a]/30">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 text-blue-500" onClick={() => setMobileView("folders")}><ChevronLeft size={20}/></button>
            <span className="text-xs font-black uppercase text-blue-400 tracking-widest">{selectedFolder}</span>
          </div>
          {!isGestióUsuaris && <button onClick={async () => { if(confirm("Vols buidar el xat d'aquesta unitat?")) { await supabase.from('missatges').delete().eq('unitat', selectedFolder).eq('user_id', user.id); setMessages([]); } }} className="text-[10px] text-slate-500 hover:text-red-400 flex items-center gap-2 font-black uppercase"><Eraser size={14}/> Buidar</button>}
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6">
          {isGestióUsuaris ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allUsers.map(u => (
                <div key={u.id} className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="font-black text-sm break-all">{u.email}</div>
                  <div className="text-[10px] text-blue-400 uppercase font-bold">{u.cos_policial}</div>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(n => <button key={n} onClick={async () => { const ns = u.nivell?.includes(n) ? u.nivell.filter(v => v !== n) : [...(u.nivell || []), n]; await supabase.from('usuaris').update({ nivell: ns }).eq('id', u.id); setAllUsers(allUsers.map(usr => usr.id === u.id ? { ...usr, nivell: ns } : usr)); }} className={`w-7 h-7 rounded-lg text-[10px] font-black ${u.nivell?.includes(n) ? 'bg-blue-600' : 'bg-slate-700 text-slate-500'}`}>{n}</button>)}
                  </div>
                  <div className="flex justify-between">
                    {u.estat !== 'ACTIU' && <button onClick={async () => { await supabase.from('usuaris').update({ estat: 'ACTIU' }).eq('id', u.id); setAllUsers(allUsers.map(usr => usr.id === u.id ? { ...usr, estat: 'ACTIU' } : usr)); }} className="text-[9px] px-3 py-1 bg-emerald-600 rounded-lg uppercase font-black">Activar</button>}
                    <button onClick={async () => { if(confirm("Eliminar usuari?")) { await supabase.from('usuaris').delete().eq('id', u.id); setAllUsers(allUsers.filter(usr => usr.id !== u.id)); } }} className="text-[9px] px-3 py-1 bg-red-600 rounded-lg uppercase font-black">Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {messages.filter(m => m.unitat === selectedFolder).map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="flex flex-col gap-2 max-w-[90%] md:max-w-2xl">
                    <div className={`p-4 md:p-5 rounded-2xl text-[14px] leading-relaxed shadow-lg ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-[#1e293b] border border-slate-700 text-slate-200'}`}>
                      {m.role === 'assistant' ? (
                        <div className="prose prose-invert max-w-none prose-sm">
                          <ReactMarkdown>{m.text}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{m.text}</div>
                      )}
                    </div>
                    {m.role === 'assistant' && m.font_info && <div className="text-[10px] text-blue-400 font-black italic px-2"><BookOpen size={12} className="inline mr-1"/> FONT: {m.font_info}</div>}
                    {m.role === 'assistant' && isRedaccio && <button onClick={() => descarregarActaWord(m.text)} className="self-start flex items-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all border border-blue-500/20 mt-1"><Download size={14}/> Generar Acta</button>}
                  </div>
                </div>
              ))}
              {isTyping && <div className="text-blue-400 text-[10px] animate-pulse uppercase font-black italic">Processant consulta...</div>}
            </>
          )}
        </div>

        {!isGestióUsuaris && (
          <footer className="p-4 md:p-10">
            <div className="max-w-4xl mx-auto flex gap-2 bg-[#1e293b] p-2 md:p-4 rounded-[2rem] border border-slate-700 items-end shadow-2xl">
              {(function find(list, name) { for (const i of list) { if (i.name === name) return i; if (i.subfolders) { const f = find(i.subfolders, name); if (f) return f; } } return null; })(folders, selectedFolder)?.isPhotoFolder && (
                <button onClick={() => photoInputRef.current.click()} className="p-3 bg-slate-700 text-sky-400 rounded-2xl relative shrink-0">
                  <ImageIcon size={20}/>
                  {pendingPhotos.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-5 h-5 flex items-center justify-center rounded-full font-black">{pendingPhotos.length}</span>}
                </button>
              )}
              <button onClick={toggleMic} className={`p-3 rounded-2xl shrink-0 transition-all ${isListening ? 'bg-red-600 animate-pulse text-white' : 'bg-slate-700 text-slate-400'}`}><Mic size={20}/></button>
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Escriu o dicta aquí..." className="flex-1 bg-transparent outline-none text-[15px] resize-none min-h-[40px] py-2 px-2 text-white" />
              <button onClick={sendMessage} className="bg-blue-600 p-3 rounded-2xl text-white transition-colors shrink-0"><Send size={20}/></button>
            </div>
          </footer>
        )}
      </main>
    </div>
  );
}

export default App;
