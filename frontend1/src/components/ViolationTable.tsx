import { useEffect, useState } from "react";
import API from "../api/api";

interface Violation {
  id: number;
  plate_number: string;
  violation_type: string;
  confidence_score: number;
  status: string;
}

function ViolationsTable() {
  const [violations, setViolations] = useState<Violation[]>([]);

  useEffect(() => {
    API.get("/violations")
      .then(res => setViolations(res.data))
      .catch(() => alert("Error loading violations"));
  }, []);

  return (
    <table>
      <thead>
        <tr>
          <th>Plate</th>
          <th>Type</th>
          <th>Confidence</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {violations.map(v => (
          <tr key={v.id}>
            <td>{v.plate_number}</td>
            <td>{v.violation_type}</td>
            <td>{v.confidence_score}</td>
            <td>{v.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ViolationsTable;
