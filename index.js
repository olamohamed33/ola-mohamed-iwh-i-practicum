require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();

app.set('view engine', 'pug');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- config from env
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const COBJ = process.env.CUSTOM_OBJECT_TYPE || 'contacts'; // e.g. '0-1' for custom object, or 'contacts'
const PORT = process.env.PORT || 3000;

if (!HUBSPOT_TOKEN) {
  console.error('HUBSPOT_TOKEN missing in environment. Add it to your .env file (do NOT commit it).');
  process.exit(1);
}

const hubspot = axios.create({
  baseURL: 'https://api.hubapi.com',
  headers: {
    Authorization: `Bearer ${HUBSPOT_TOKEN}`,
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// Helper: build properties list used in GET to display table columns
const DEFAULT_PROPS = ['name', 'full_name', 'bio', 'other', 'email'];

// ---------- Routes ----------

// Homepage: list records
app.get('/', async (req, res) => {
  try {
    const props = DEFAULT_PROPS; // change if you want different columns
    const resp = await hubspot.get(`/crm/v3/objects/${encodeURIComponent(COBJ)}`, {
      params: {
        properties: props.join(','),
        limit: 100
      }
    });

    const records = resp.data.results || [];
    res.render('homepage', { title: 'Homepage', records, props });
  } catch (err) {
    // Log helpful info
    console.error('Fetch error:', err.response?.status, err.response?.data || err.message);
    res.render('homepage', {
      title: 'Homepage',
      records: [],
      props: DEFAULT_PROPS,
      error: 'Failed to fetch records from HubSpot. Check server logs for details.'
    });
  }
});

// Render form to create new record
app.get('/update-cobj', (req, res) => {
  res.render('updates', {
    title: 'Update Custom Object Form | Integrating With HubSpot I Practicum'
  });
});

// Handle form submission and create record in HubSpot
app.post('/update-cobj', async (req, res) => {
  try {
    // collect values from form (accept name or full_name as fallback)
    const nameValue = req.body.name || req.body.full_name || '';
    const fullNameValue = req.body.full_name || req.body.name || '';
    const bioValue = req.body.bio || '';
    const otherValue = req.body.other || '';
    const emailValue = req.body.email || '';

    // Build request body - include "name" property (required by practicum)
    const body = {
      properties: {
        name: nameValue,
        full_name: fullNameValue,
        bio: bioValue,
        other: otherValue,
        email: emailValue
      }
    };

    const createResp = await hubspot.post(`/crm/v3/objects/${encodeURIComponent(COBJ)}`, body);

    // NOTE: Requirement asks to associate custom object with contacts object type.
    // Associations are often managed in the HubSpot UI when you create the custom object schema.
    // If you want to programmatically associate this new object with a contact,
    // you would need to call the associations endpoint here using the created object's id
    // and a contact id. That is optional for the basic practicum if you've already set up the schema association in the portal.

    // Redirect to homepage so new record appears in list
    res.redirect('/');
  } catch (err) {
    console.error('Error creating record:', err.response?.status, err.response?.data || err.message);
    // For debugging, show a readable error page (but don't leak tokens)
    res.status(500).render('updates', {
      title: 'Update Custom Object Form | Integrating With HubSpot I Practicum',
      error: 'Failed to create record. Check server logs for details.',
      formData: req.body
    });
  }
});

// Start server
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
