try {
  const strapi = require('@strapi/strapi');
  console.log('Strapi module found');
  console.log('Factories exists:', !!strapi.factories);
} catch (e) {
  console.error('Error finding strapi module:', e.message);
}

