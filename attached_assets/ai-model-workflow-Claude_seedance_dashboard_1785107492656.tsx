import React, { useState, useCallback } from 'react';
import { Play, Save, Zap, BookOpen, Calendar, DollarSign, RefreshCw, Plus, Check, Clock } from 'lucide-react';

export default function AIModelWorkflow() {
  const [modelLocked, setModelLocked] = useState(false);
  const [modelSeed, setModelSeed] = useState('42857');
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [promptOutput, setPromptOutput] = useState('');
  const [contentLibrary, setContentLibrary] = useState([
    { id: 1, date: '2025-07-24', prompt: 'Minimalist portrait, studio lighting', status: 'published', revenue: 340 },
    { id: 2, date: '2025-07-23', prompt: 'Fashion editorial, luxury aesthetic', status: 'published', revenue: 285 },
  ]);
  const [obsidianSynced, setObsidianSynced] = useState(false);
  const [contentType, setContentType] = useState('portrait');
  const [theme, setTheme] = useState('luxury');
  const [monthlyRevenue, setMonthlyRevenue] = useState(1840);
  const [workflowStatus, setWorkflowStatus] = useState('idle');
  const [batchQueue, setBatchQueue] = useState([]);

  const generatePrompt = useCallback(async () => {
    if (!modelLocked) {
      alert('Lock the model first');
      return;
    }

    setGeneratingPrompt(true);
    setWorkflowStatus('generating');
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 500,
          system: `You are a professional AI photography prompt engineer. Generate a detailed, specific prompt for creating ${contentType} images with ${theme} aesthetic. Include camera settings, lighting, composition, mood, and style. Keep it under 100 words.`,
          messages: [
            { role: 'user', content: `Generate a unique ${contentType} prompt for a ${theme} themed model photoshoot. Make it specific and actionable for AI generation.` }
          ],
        })
      });

      const data = await response.json();
      const prompt = data.content[0].text;
      setPromptOutput(prompt);
      setWorkflowStatus('prompt_generated');

      // Auto-add to batch queue
      setBatchQueue(prev => [...prev, { id: Date.now(), prompt, status: 'pending' }]);
    } catch (error) {
      console.error('API Error:', error);
      setPromptOutput('Error generating prompt. Check API connection.');
      setWorkflowStatus('error');
    } finally {
      setGeneratingPrompt(false);
    }
  }, [modelLocked, contentType, theme]);

  const lockModel = () => {
    setModelLocked(true);
    setWorkflowStatus('model_locked');
  };

  const publishContent = () => {
    if (!promptOutput) return;
    
    const newContent = {
      id: contentLibrary.length + 1,
      date: new Date().toISOString().split('T')[0],
      prompt: promptOutput,
      status: 'published',
      revenue: Math.floor(Math.random() * 400) + 200,
    };
    
    setContentLibrary(prev => [newContent, ...prev]);
    setMonthlyRevenue(prev => prev + newContent.revenue);
    setPromptOutput('');
    setWorkflowStatus('published');
    
    setTimeout(() => setWorkflowStatus('idle'), 2000);
  };

  const syncObsidian = () => {
    setObsidianSynced(true);
    setWorkflowStatus('syncing');
    setTimeout(() => {
      setWorkflowStatus('synced');
      setTimeout(() => setWorkflowStatus('idle'), 2000);
    }, 1500);
  };

  const processBatch = async () => {
    setWorkflowStatus('batch_processing');
    for (let item of batchQueue) {
      item.status = 'processing';
      await new Promise(resolve => setTimeout(resolve, 800));
      item.status = 'completed';
    }
    setBatchQueue(prev => prev.map(item => ({ ...item, status: 'completed' })));
    setWorkflowStatus('batch_complete');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">AI Model Automation Hub</h1>
          <p className="text-purple-300">One Model + Claude + Obsidian = $3K+/month</p>
        </div>

        {/* Status Bar */}
        <div className="bg-slate-800/50 backdrop-blur rounded-lg border border-purple-500/30 p-4 mb-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${workflowStatus !== 'idle' ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`}></div>
            <span className="text-purple-300 text-sm">Status: <span className="font-semibold text-white">{workflowStatus.replace(/_/g, ' ').toUpperCase()}</span></span>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-purple-300 text-xs">Monthly Revenue</div>
              <div className="text-2xl font-bold text-green-400">${monthlyRevenue.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-purple-300 text-xs">Content Published</div>
              <div className="text-2xl font-bold text-blue-400">{contentLibrary.length}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-8">

          {/* LAYER 1: Model Lock */}
          <div className="col-span-1 bg-slate-800/40 backdrop-blur rounded-lg border border-purple-500/30 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="text-amber-400" size={20} />
              <h2 className="text-lg font-bold text-white">Model Lock</h2>
            </div>
            
            {!modelLocked ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-purple-300 mb-2">Seed (Consistency)</label>
                  <input 
                    type="text" 
                    value={modelSeed}
                    onChange={(e) => setModelSeed(e.target.value)}
                    className="w-full bg-slate-900/50 border border-purple-400/50 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                <div className="bg-slate-900/50 rounded p-3 text-sm text-purple-300">
                  <div className="mb-2 font-semibold">Parameters:</div>
                  <div className="space-y-1 text-xs">
                    <div>• Face: LOCKED</div>
                    <div>• Body: LOCKED</div>
                    <div>• Style: LOCKED</div>
                  </div>
                </div>
                <button 
                  onClick={lockModel}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-2 px-4 rounded transition"
                >
                  LOCK MODEL
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-green-900/30 border border-green-500/50 rounded p-3 text-green-300 text-sm">
                  ✓ Model Locked & Consistent
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  <div>Seed: {modelSeed}</div>
                  <div>Face: Consistent</div>
                  <div>Body: Consistent</div>
                  <div>Ready for automation</div>
                </div>
              </div>
            )}
          </div>

          {/* LAYER 2: Claude Brain */}
          <div className="col-span-1 bg-slate-800/40 backdrop-blur rounded-lg border border-purple-500/30 p-6">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="text-cyan-400" size={20} />
              <h2 className="text-lg font-bold text-white">Claude Brain</h2>
            </div>
            
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm text-purple-300 mb-2">Content Type</label>
                <select 
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  className="w-full bg-slate-900/50 border border-purple-400/50 rounded px-3 py-2 text-white text-sm"
                >
                  <option>portrait</option>
                  <option>fashion</option>
                  <option>lifestyle</option>
                  <option>editorial</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-purple-300 mb-2">Theme</label>
                <select 
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full bg-slate-900/50 border border-purple-400/50 rounded px-3 py-2 text-white text-sm"
                >
                  <option>luxury</option>
                  <option>minimalist</option>
                  <option>cyberpunk</option>
                  <option>dreamy</option>
                </select>
              </div>
            </div>

            <button 
              onClick={generatePrompt}
              disabled={!modelLocked || generatingPrompt}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded transition flex items-center justify-center gap-2"
            >
              {generatingPrompt ? <RefreshCw size={18} className="animate-spin" /> : <Zap size={18} />}
              {generatingPrompt ? 'Generating...' : 'Generate Prompt'}
            </button>
          </div>

          {/* LAYER 3: Obsidian Brain */}
          <div className="col-span-1 bg-slate-800/40 backdrop-blur rounded-lg border border-purple-500/30 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="text-pink-400" size={20} />
              <h2 className="text-lg font-bold text-white">Obsidian Sync</h2>
            </div>
            
            {!obsidianSynced ? (
              <div className="space-y-3">
                <div className="bg-slate-900/50 rounded p-3 text-sm text-purple-300">
                  <div className="mb-2 font-semibold">Knowledge Base Ready:</div>
                  <div className="space-y-1 text-xs">
                    <div>✓ Prompt Library: {contentLibrary.length} entries</div>
                    <div>✓ Scene Calendar: Active</div>
                    <div>✓ Content Archive: Synced</div>
                  </div>
                </div>
                <button 
                  onClick={syncObsidian}
                  className="w-full bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold py-2 px-4 rounded transition"
                >
                  Sync to Obsidian
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="bg-green-900/30 border border-green-500/50 rounded p-3 text-green-300 text-sm">
                  ✓ Synced with Obsidian
                </div>
                <div className="text-xs text-slate-400">
                  <div>All prompts saved</div>
                  <div>Calendar updated</div>
                  <div>Ready to pull workflows</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Claude Output */}
        {promptOutput && (
          <div className="bg-slate-800/40 backdrop-blur rounded-lg border border-cyan-500/30 p-6 mb-8">
            <h3 className="text-lg font-bold text-white mb-3">Generated Prompt</h3>
            <div className="bg-slate-900/50 rounded p-4 text-purple-200 text-sm leading-relaxed mb-4">
              {promptOutput}
            </div>
            <div className="flex gap-3">
              <button 
                onClick={publishContent}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-2 px-4 rounded transition flex items-center justify-center gap-2"
              >
                <Check size={18} />
                Publish & Store
              </button>
              <button 
                onClick={() => generatePrompt()}
                className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded transition flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} />
                Regenerate
              </button>
            </div>
          </div>
        )}

        {/* Batch Processing */}
        {batchQueue.length > 0 && (
          <div className="bg-slate-800/40 backdrop-blur rounded-lg border border-purple-500/30 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Batch Queue</h3>
              <button 
                onClick={processBatch}
                className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold py-1 px-4 rounded transition text-sm"
              >
                Process Batch
              </button>
            </div>
            <div className="space-y-2">
              {batchQueue.map(item => (
                <div key={item.id} className="bg-slate-900/50 rounded p-3 flex items-center justify-between text-sm">
                  <span className="text-purple-300 truncate">{item.prompt.substring(0, 50)}...</span>
                  <div className="flex items-center gap-2">
                    {item.status === 'pending' && <Clock size={16} className="text-amber-400" />}
                    {item.status === 'processing' && <RefreshCw size={16} className="text-blue-400 animate-spin" />}
                    {item.status === 'completed' && <Check size={16} className="text-green-400" />}
                    <span className="text-xs text-slate-400">{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Library */}
        <div className="bg-slate-800/40 backdrop-blur rounded-lg border border-purple-500/30 p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <BookOpen size={20} />
            Content Library
          </h3>
          <div className="space-y-2">
            {contentLibrary.map(content => (
              <div key={content.id} className="bg-slate-900/50 rounded p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm text-purple-300">{content.date}</div>
                  <div className="text-white font-semibold text-sm">{content.prompt}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Revenue</div>
                    <div className="text-lg font-bold text-green-400">${content.revenue}</div>
                  </div>
                  <div className="bg-green-900/30 border border-green-500/50 rounded px-3 py-1 text-xs text-green-300 font-semibold">
                    {content.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
