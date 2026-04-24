# 🛡️ Linee Guida di Sicurezza per l'uso di Gemini CLI

Questo documento stabilisce le procedure di sicurezza obbligatorie per l'interazione con i modelli Gemini (Pro, Flash, Flash-Lite) tramite interfaccia a riga di comando (CLI) all'interno di questo progetto.

## 1. Protezione dei Dati Sensibili (Data Privacy)

È severamente vietato inviare segreti o dati personali ai modelli AI.

- **File .env:** Non eseguire mai comandi che leggono direttamente file di configurazione. 
  - ❌ *Evitare:* `cat backend/.env | gemini "spiega questo"`
  - ✅ *Best Practice:* Se devi debuggare una variabile, scrivi il nome della variabile manualmente senza il valore.
- **API Keys e Credenziali:** Assicurati che nessuna chiave (Google Cloud, AWS, database) sia presente nel contesto del prompt. Non esporre mai API keys e informazioni sensibili al frontend.
- **Dati dei Clienti:** Prima di inviare log di errore o database dump, anonimizza nomi, email e indirizzi IP.

## 2. Token Economy & Efficienza (Costi)

Per massimizzare l'abbonamento Google Pro e ridurre lo spreco di token:

- **Selezione Modello:**
  - Utilizzare `gemini-2.0-flash-lite` per domande rapide, spiegazioni di codice o generazione di README.
  - Utilizzare `gemini-3.1-pro` solo per ragionamenti logici complessi o architettura di sistema.
- **Gestione del Contesto:**
  - Usa il comando `/reset` o `/clear` tra domande su argomenti diversi. Inviare l'intera cronologia della chat per ogni nuova domanda consuma token esponenzialmente.
- **Limitazione Output:** Imposta sempre un limite massimo di token se il tuo CLI lo permette (es. `--max-output-tokens 500`).

## 3. Validazione del Codice Generato

L'AI può generare "allucinazioni" (comandi o flag inesistenti).

- **No Copy-Paste Diretto:** Non eseguire mai script o comandi shell generati da Gemini direttamente nel terminale senza prima averli revisionati.
- **Sanity Check:** Prima di eseguire un comando complesso suggerito, usa `echo "comando"` o esegui il codice in un ambiente di test (sandbox/container).
- **Audit delle Dipendenze:** Se Gemini suggerisce di installare nuove librerie, verifica prima la loro popolarità e sicurezza su npm/PyPI.

## 4. Strumenti di Supporto

- **.geminiignore:** Utilizza il file `.geminiignore` per elencare i file che non devono MAI essere passati al CLI tramite script di automazione.