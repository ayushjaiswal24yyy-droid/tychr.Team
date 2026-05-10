'use strict';

const strapiFactory = require('@strapi/strapi');

async function run() {
  const app = await strapiFactory().load();

  try {
    const knex = app.db.connection;

    const hasLinksTable = await knex.schema.hasTable(
      'third_party_offerings_created_by_user_links'
    );
    if (!hasLinksTable) {
      console.error('[repair][ownership] Missing relation table.');
      return;
    }

    const rows = await knex('third_party_offerings as tpo')
      .leftJoin(
        'third_party_offerings_created_by_user_links as link',
        'link.third_party_offering_id',
        'tpo.id'
      )
      .leftJoin('admin_users as au', 'au.id', 'tpo.created_by_id')
      .leftJoin('up_users as up', 'up.email', 'au.email')
      .select(
        'tpo.id as offering_id',
        'up.id as user_id',
        'link.id as link_id'
      );

    const inserts = rows
      .filter((row) => !row.link_id && row.user_id)
      .map((row) => ({
        third_party_offering_id: row.offering_id,
        user_id: row.user_id
      }));

    if (inserts.length === 0) {
      console.log('[repair][ownership] No missing links to insert.');
      return;
    }

    await knex('third_party_offerings_created_by_user_links')
      .insert(inserts)
      .onConflict(['third_party_offering_id', 'user_id'])
      .ignore();

    console.log(
      `[repair][ownership] Inserted ${inserts.length} ownership links.`
    );
  } finally {
    await app.destroy();
  }
}

run().catch((err) => {
  console.error('[repair][ownership] Failed:', err);
  process.exitCode = 1;
});
