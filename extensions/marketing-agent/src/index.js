import path from 'path';
import { fileURLToPath } from 'url';
 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
 
export default function createExtension() {
  return {
    name: "marketing-agent",
    publicPath: path.join(__dirname, '..', 'public')
  };
}
 