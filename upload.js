import fetch from "node-fetch";

const STRAPI_URL = "https://backend-2.tychr.com/api/tutors-websites";
const STRAPI_TOKEN = "7a7846a074b8eb21167b619ec731cab86ed2c0f2723b726f0421dd785faed72e60783be1cb830ac7a8f49516119f5de85993c844fb2dbf2a8d9818eec4cb63ef46ef01c064ce1f7697d288105432418b2d4f5986103bde82c190899a7a3bde29ee0e004299e772a7b3e1b3ad590276581f371868d7beb6a2957cc8b0e44bfd35"; // create from Strapi > Settings > API Tokens
const SHEET_URL = "https://script.google.com/macros/s/AKfycbxGBnMnCnsxs42b8JaTXGpnPWnGMOF_NU3dMjpKJ-HTNBJyYJIbwxuhRAjcCWg-I22Frg/exec";


async function uploadData() {
  const sheetData = await fetch(SHEET_URL).then(r => r.json());

  for (const row of sheetData) {
    const res = await fetch(STRAPI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${STRAPI_TOKEN}`
      },
      body: JSON.stringify({ data: row })
    });

    const result = await res.json();
    console.log("Created:", result);
    await new Promise(r => setTimeout(r, 300)); // avoid rate limits
  }
}

uploadData();
