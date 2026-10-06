import fs from 'fs';
import path from 'path';

const dir = './src';

// The requested accessible color palette mapping:
// Main BG: #121212
// Secondary BG/Cards: #1A1A1C
// Surfaces/Containers: #202024 / #26262B
// Borders: #3A3A3E
// Inputs: #2C2C32
// Accent: #E85A80 / #F46C8E
// Primary text: #FFFFFF / #F3F4F6
// Secondary text: #B3B3B3 / #D1D5DB

const replacements = [
  // Backgrounds
  { regex: /bg-\[#0f111a\]/g, replace: 'bg-[#121212]' },
  { regex: /bg-\[#12141e\]/g, replace: 'bg-[#161618]' },
  { regex: /bg-\[#151824\]/g, replace: 'bg-[#1A1A1C]' },
  { regex: /bg-\[#161925\]/g, replace: 'bg-[#202024]' },
  
  // Pink Accents to Desaturated Accent (#E85A80 / #F46C8E)
  { regex: /text-pink-400/g, replace: 'text-[#F46C8E]' },
  { regex: /text-pink-500/g, replace: 'text-[#E85A80]' },
  { regex: /bg-pink-600/g, replace: 'bg-[#E85A80]' },
  { regex: /hover:bg-pink-700/g, replace: 'hover:bg-[#D94F74]' },
  { regex: /hover:bg-pink-500/g, replace: 'hover:bg-[#F46C8E]' },
  { regex: /border-pink-500/g, replace: 'border-[#E85A80]' },
  { regex: /focus:border-pink-500/g, replace: 'focus:border-[#E85A80]' },
  
  // Inputs & Borders
  { regex: /border-gray-800/g, replace: 'border-[#3A3A3E]' },
  { regex: /border-gray-700/g, replace: 'border-[#3A3A3E]' },
  { regex: /bg-gray-800/g, replace: 'bg-[#2C2C32]' },
  { regex: /hover:bg-gray-700/g, replace: 'hover:bg-[#3A3A3E]' },
  { regex: /bg-gray-900/g, replace: 'bg-[#202024]' },

  // Texts
  { regex: /text-gray-400/g, replace: 'text-[#B3B3B3]' },
  { regex: /text-gray-500/g, replace: 'text-[#9CA3AF]' }, // Keep slightly darker or same
  { regex: /text-gray-300/g, replace: 'text-[#D1D5DB]' },

  // Font sizes & Padding adjustments (minimum 44px touch target via py-2.5 or min-h-[44px])
  // To avoid breaking things, we inject min-h-[44px] on button and select tags if they don't have it
];

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      // Apply regex replacements
      replacements.forEach(rule => {
        if (rule.regex.test(content)) {
          content = content.replace(rule.regex, rule.replace);
          modified = true;
        }
      });

      // Simple heuristic to add min-h-[44px] and text-base to buttons and selects if not present
      if (fullPath.endsWith('.tsx')) {
        const buttonRegex = /<button[^>]*className="([^"]*)"/g;
        content = content.replace(buttonRegex, (match, classes) => {
          let newClasses = classes;
          if (!classes.includes('min-h-') && !classes.includes('h-') && !classes.includes('p-1') && !classes.includes('text-[10px]') && !classes.includes('text-[11px]') && !classes.includes('px-2 py-0.5')) {
             if (!newClasses.includes('min-h-[44px]')) {
                 newClasses += ' min-h-[44px]';
                 modified = true;
             }
          }
          if (classes.includes('text-xs')) {
            newClasses = newClasses.replace('text-xs', 'text-sm');
            modified = true;
          } else if (classes.includes('text-sm')) {
            newClasses = newClasses.replace('text-sm', 'text-base');
            modified = true;
          }
          return match.replace(classes, newClasses);
        });

        const selectRegex = /<select[^>]*className="([^"]*)"/g;
        content = content.replace(selectRegex, (match, classes) => {
          let newClasses = classes;
          if (!newClasses.includes('min-h-[44px]')) {
             newClasses += ' min-h-[44px]';
             modified = true;
          }
          return match.replace(classes, newClasses);
        });

        const inputRegex = /<input[^>]*className="([^"]*)"/g;
        content = content.replace(inputRegex, (match, classes) => {
          let newClasses = classes;
          if (!newClasses.includes('min-h-[44px]')) {
             newClasses += ' min-h-[44px]';
             modified = true;
          }
          return match.replace(classes, newClasses);
        });
        
        const tdRegex = /<td[^>]*className="([^"]*)"/g;
        content = content.replace(tdRegex, (match, classes) => {
          let newClasses = classes;
          if (!classes.includes('py-') && !classes.includes('p-')) {
             newClasses += ' py-4'; // 16px vertical padding for rows
             modified = true;
          } else if (classes.includes('py-2') || classes.includes('py-1')) {
             newClasses = newClasses.replace(/py-[12]\.?[5]?/g, 'py-4');
             modified = true;
          }
          return match.replace(classes, newClasses);
        });
      }

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

processDirectory(dir);
console.log('UI overhaul replacements completed.');
