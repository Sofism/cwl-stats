const PROXY_URL = process.env.REACT_APP_COC_PROXY_URL;

export const getClanMembers = async (clanTag) => {
  try {
    const encodedTag = encodeURIComponent(clanTag);
    const response = await fetch(
      `${PROXY_URL}/api/coc?endpoint=clans/${encodedTag}/members`
    );
    const data = await response.json();
    return data.items || [];
  } catch (err) {
    console.error('Error fetching clan members:', err);
    return [];
  }
};

export const getClanInfo = async (clanTag) => {
  try {
    const encodedTag = encodeURIComponent(clanTag);
    const response = await fetch(
      `${PROXY_URL}/api/coc?endpoint=clans/${encodedTag}`
    );
    return await response.json();
  } catch (err) {
    console.error('Error fetching clan info:', err);
    return null;
  }
};
