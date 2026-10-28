import LegalDocumentView from "../components/LegalDocumentView";
import { cookiePolicy } from "../../content/legal/cookie";

export default function CookiePolicyPage() {
  return <LegalDocumentView document={cookiePolicy} />;
}
