import LegalDocumentView from "../components/LegalDocumentView";
import { privacyPolicy } from "../../content/legal/privacy";

export default function PrivacyPolicyPage() {
  return <LegalDocumentView document={privacyPolicy} />;
}
