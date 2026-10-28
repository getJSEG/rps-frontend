import LegalDocumentView from "../components/LegalDocumentView";
import { termsAndConditions } from "../../content/legal/terms";

export default function TermsPage() {
  return <LegalDocumentView document={termsAndConditions} />;
}
