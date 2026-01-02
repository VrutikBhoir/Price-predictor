import { supabase } from "../lib/supabase";
import { useEffect, useState } from "react";

export default function TestDB() {
  const [data, setData] = useState([]);

  useEffect(() => {
    supabase.from("users").select("*").then((res) => {
      setData(res.data || []);
    });
  }, []);
  console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
 console.log("KEY:", process.env.NEXT_PUBLIC_SUPABASE_KEY);


  return (
    <pre>{JSON.stringify(data, null, 2)}</pre>
  );
}
