function App() {
  const [input, setInput] = useState('I want to go to us at 8th march 2026');
  const [plan, setPlan] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input) return;
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:8000/api/plan', { text: input });
      setPlan(response.data.plan);
    } catch (error) {
      console.error(error);
      setPlan('Failed to fetch plan.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="App" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Government Filing & Travel Agent</h1>
      <p>Enter your goal below to get a simplified procedure, document checklist, to-do list, and reminders.</p>
      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <textarea 
          style={{ width: '100%', padding: '10px', fontSize: '16px' }}
          rows="4" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g., I want to go to us at 8th march 2026"
        />
        <br />
        <button 
          type="submit" 
          disabled={loading}
          style={{ padding: '10px 20px', fontSize: '16px', marginTop: '10px', cursor: 'pointer' }}
        >
          {loading ? 'Generating Plan...' : 'Get Plan'}
        </button>
      </form>
      
      {plan && (
        <div className="result" style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h2>Your Plan:</h2>
          <div style={{ textAlign: 'left', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
            {plan}
          </div>
        </div>
      )}
    </div>
  );
}
export default App;