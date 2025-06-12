export const translateText = async (text, toLanguage) => {
 if (!toLanguage) return text; // No translation if no target language

 const subscriptionKey =
  "1Jwi25Aev9zUhnFy4SjIu5ftbnbsOzpbA0lzpLwLA9IjdJhdwSp6JQQJ99BEACqBBLyXJ3w3AAAbACOG18p0"; // Keep secure in production
 const endpoint = "https://api.cognitive.microsofttranslator.com";
 const location = "southeastasia";

 const url = `${endpoint}/translate?api-version=3.0&to=${toLanguage}`;

 try {
  const response = await fetch(url, {
   method: "POST",
   headers: {
    "Ocp-Apim-Subscription-Key": subscriptionKey,
    "Ocp-Apim-Subscription-Region": location,
    "Content-type": "application/json"
   },
   body: JSON.stringify([{ Text: text }])
  });

  const data = await response.json();

  const translatedText = data?.[0]?.translations?.[0]?.text;

  if (translatedText && translatedText !== text) {
   return translatedText;
  } else {
   return null;
  }
 } catch (error) {
  console.error("Azure translation failed:", error);
  return null;
 }
};

export const detectLanguage = async (text) => {
 const subscriptionKey = "1Jwi25Aev9zUhnFy4SjIu5ftbnbsOzpbA0lzpLwLA9IjdJhdwSp6JQQJ99BEACqBBLyXJ3w3AAAbACOG18p0";
 const endpoint = "https://api.cognitive.microsofttranslator.com";
 const location = "southeastasia";

 const url = `${endpoint}/detect?api-version=3.0`;

 try {
  const response = await fetch(url, {
   method: "POST",
   headers: {
    "Ocp-Apim-Subscription-Key": subscriptionKey,
    "Ocp-Apim-Subscription-Region": location,
    "Content-type": "application/json",
   },
   body: JSON.stringify([{ Text: text }]),
  });

  const data = await response.json();

  if (Array.isArray(data) && data[0]?.language) {
   return data[0].language;
  } else {
   console.error("Language detection failed:", data);
   return "en"; // default fallback
  }
 } catch (error) {
  console.error("Error during language detection:", error);
  return "en";
 }
};