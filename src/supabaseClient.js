import { createClient } from '@supabase/supabase-js';

// CONFIGURACIÓ SUPABASE (Centralitzada: Fotos, Xat i Usuaris)
const supabaseUrl = 'https://qhdtoanljoypoxvojyud.supabase.co';
const supabaseKey = 'sb_publishable_ZfTnUSLWDLbc8aIiOkCzwA_b1xzHRON';

// Aquest és l'únic client que necessitarem per a tota l'App
export const supabase = createClient(supabaseUrl, supabaseKey);

// Nota per al Lluís: Firebase ja no existeix en aquest fitxer. 
// Tot anirà a través d'aquesta constant 'supabase'.
