import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, NodeSelection } from '@tiptap/pm/state';

const dragHandleKey = new PluginKey('dragHandle');

export const DragHandle = Extension.create({
  name: 'dragHandle',

  addStorage() {
    return {
      enabled: false,
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage as { enabled: boolean };

    return [
      new Plugin({
        key: dragHandleKey,
        view(view) {
          let currentBlockPos: number | null = null;
          let hoveringHandle = false;
          let destroyed = false;

          // ── Drag state ──
          let isDragging = false;
          let dragSourcePos: number | null = null;
          let dragSourceDom: HTMLElement | null = null;
          let dropTargetPos: number | null = null;

          // ── Create handle (position:fixed on body) ──
          const handle = document.createElement('div');
          handle.setAttribute('data-drag-handle', '');
          handle.style.cssText = [
            'position:fixed',
            'width:22px',
            'height:22px',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'border-radius:4px',
            'cursor:grab',
            'opacity:0',
            'transition:opacity 0.15s',
            'color:#9ca3af',
            'z-index:9999',
            'user-select:none',
          ].join(';');
          handle.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="pointer-events:none">
            <circle cx="5" cy="3" r="1.5"/><circle cx="11" cy="3" r="1.5"/>
            <circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/>
            <circle cx="5" cy="13" r="1.5"/><circle cx="11" cy="13" r="1.5"/>
          </svg>`;
          document.body.appendChild(handle);

          // ── Create drop indicator line (blue line between blocks) ──
          const indicator = document.createElement('div');
          indicator.style.cssText = [
            'position:fixed',
            'height:2px',
            'background:#3b82f6',
            'border-radius:1px',
            'pointer-events:none',
            'z-index:9998',
            'opacity:0',
            'transition:top 0.08s',
          ].join(';');
          // Small circles at each end of the indicator
          indicator.innerHTML = `
            <div style="position:absolute;left:-3px;top:-2px;width:6px;height:6px;background:#3b82f6;border-radius:50%"></div>
            <div style="position:absolute;right:-3px;top:-2px;width:6px;height:6px;background:#3b82f6;border-radius:50%"></div>
          `;
          document.body.appendChild(indicator);

          // ── Handle hover events ──
          handle.addEventListener('mouseenter', () => { hoveringHandle = true; });
          handle.addEventListener('mouseleave', () => {
            hoveringHandle = false;
            if (!isDragging) hideHandle();
          });
          handle.addEventListener('mouseover', () => {
            handle.style.background = '#e5e7eb';
            handle.style.color = '#6b7280';
          });
          handle.addEventListener('mouseout', () => {
            if (!isDragging) {
              handle.style.background = '';
              handle.style.color = '#9ca3af';
            }
          });

          // ── Mousedown: start custom drag ──
          handle.addEventListener('mousedown', (e) => {
            if (currentBlockPos === null) return;
            e.preventDefault();
            e.stopPropagation();
            startDrag(currentBlockPos, e.clientY);
          });

          // ── Helpers ──

          function getBlockInfo(): { pos: number; dom: HTMLElement; rect: DOMRect }[] {
            const editorDom = view.dom;
            const blocks: { pos: number; dom: HTMLElement; rect: DOMRect }[] = [];

            for (let i = 0; i < editorDom.childNodes.length; i++) {
              const child = editorDom.childNodes[i];
              if (!(child instanceof HTMLElement)) continue;
              const rect = child.getBoundingClientRect();
              if (rect.height === 0) continue;

              try {
                const posData = view.posAtCoords({ left: rect.left + 1, top: rect.top + 1 });
                if (!posData) continue;
                const resolved = view.state.doc.resolve(posData.pos);
                const depth = Math.min(resolved.depth, 1);
                const blockPos = depth > 0 ? resolved.before(depth) : 0;
                blocks.push({ pos: blockPos, dom: child, rect });
              } catch {
                continue;
              }
            }
            return blocks;
          }

          function startDrag(sourcePos: number, _startY: number) {
            isDragging = true;
            dragSourcePos = sourcePos;

            // Select the block
            const node = view.state.doc.nodeAt(sourcePos);
            if (!node) { isDragging = false; return; }
            try {
              const sel = NodeSelection.create(view.state.doc, sourcePos);
              view.dispatch(view.state.tr.setSelection(sel));
            } catch { /* ignore */ }

            // Find source DOM and dim it
            const blocks = getBlockInfo();
            const sourceBlock = blocks.find(b => b.pos === sourcePos);
            if (sourceBlock) {
              dragSourceDom = sourceBlock.dom;
              dragSourceDom.style.opacity = '0.35';
              dragSourceDom.style.transition = 'opacity 0.15s';
            }

            handle.style.cursor = 'grabbing';
            handle.style.color = '#3b82f6';
            document.body.style.cursor = 'grabbing';

            document.addEventListener('mousemove', onDragMove);
            document.addEventListener('mouseup', onDragEnd);
          }

          function onDragMove(e: MouseEvent) {
            if (!isDragging) return;

            const blocks = getBlockInfo();
            if (blocks.length === 0) {
              indicator.style.opacity = '0';
              dropTargetPos = null;
              return;
            }

            const editorRect = view.dom.getBoundingClientRect();
            let bestInsertPos: number | null = null;
            let bestIndicatorY: number | null = null;

            // Find drop position — check each gap between blocks
            for (let i = 0; i < blocks.length; i++) {
              const block = blocks[i];
              const midY = block.rect.top + block.rect.height / 2;

              if (e.clientY < midY) {
                // Insert before this block
                bestInsertPos = block.pos;
                bestIndicatorY = block.rect.top - 1;
                break;
              }
            }

            // If not found, insert after the last block
            if (bestInsertPos === null && blocks.length > 0) {
              const last = blocks[blocks.length - 1];
              const node = view.state.doc.nodeAt(last.pos);
              bestInsertPos = last.pos + (node?.nodeSize || 0);
              bestIndicatorY = last.rect.bottom + 1;
            }

            // Skip if dropping at or adjacent to source (no-op)
            if (
              bestInsertPos !== null &&
              dragSourcePos !== null
            ) {
              const sourceNode = view.state.doc.nodeAt(dragSourcePos);
              const sourceEnd = dragSourcePos + (sourceNode?.nodeSize || 0);
              if (bestInsertPos >= dragSourcePos && bestInsertPos <= sourceEnd) {
                indicator.style.opacity = '0';
                dropTargetPos = null;
                return;
              }
            }

            dropTargetPos = bestInsertPos;

            if (bestIndicatorY !== null) {
              indicator.style.left = `${editorRect.left}px`;
              indicator.style.width = `${editorRect.width}px`;
              indicator.style.top = `${bestIndicatorY}px`;
              indicator.style.opacity = '1';
            } else {
              indicator.style.opacity = '0';
            }
          }

          function onDragEnd() {
            document.removeEventListener('mousemove', onDragMove);
            document.removeEventListener('mouseup', onDragEnd);

            // Hide indicator
            indicator.style.opacity = '0';

            // Restore source DOM
            if (dragSourceDom) {
              dragSourceDom.style.opacity = '';
              dragSourceDom.style.transition = '';
              dragSourceDom = null;
            }

            // Execute the move
            if (dragSourcePos !== null && dropTargetPos !== null) {
              moveBlock(dragSourcePos, dropTargetPos);
            }

            isDragging = false;
            dragSourcePos = null;
            dropTargetPos = null;
            handle.style.cursor = 'grab';
            handle.style.color = '#9ca3af';
            handle.style.background = '';
            document.body.style.cursor = '';
            hideHandle();
          }

          function moveBlock(fromPos: number, toPos: number) {
            const { state } = view;
            const node = state.doc.nodeAt(fromPos);
            if (!node) return;

            const nodeSize = node.nodeSize;

            // Skip if dropping within the source block range
            if (toPos >= fromPos && toPos <= fromPos + nodeSize) return;

            const tr = state.tr;
            const nodeCopy = node.copy(node.content);

            // Delete source first, then insert at mapped target
            tr.delete(fromPos, fromPos + nodeSize);
            const mappedTo = tr.mapping.map(toPos);
            tr.insert(mappedTo, nodeCopy);

            view.dispatch(tr);
          }

          // ── Block detection for handle positioning ──

          function findBlockAtY(y: number): { pos: number; dom: HTMLElement } | null {
            const editorDom = view.dom;
            if (!editorDom.isConnected) return null;

            for (let i = 0; i < editorDom.childNodes.length; i++) {
              const child = editorDom.childNodes[i];
              if (!(child instanceof HTMLElement)) continue;
              const rect = child.getBoundingClientRect();
              if (rect.height === 0) continue;

              if (y >= rect.top - 4 && y <= rect.bottom + 4) {
                try {
                  const posData = view.posAtCoords({ left: rect.left + 1, top: rect.top + 1 });
                  if (!posData) continue;
                  const resolved = view.state.doc.resolve(posData.pos);
                  const depth = Math.min(resolved.depth, 1);
                  const blockPos = depth > 0 ? resolved.before(depth) : 0;
                  return { pos: blockPos, dom: child };
                } catch {
                  continue;
                }
              }
            }
            return null;
          }

          function showHandle(dom: HTMLElement, pos: number) {
            currentBlockPos = pos;
            const blockRect = dom.getBoundingClientRect();
            handle.style.top = `${blockRect.top + 2}px`;
            handle.style.left = `${blockRect.left - 28}px`;
            handle.style.opacity = '1';
          }

          function hideHandle() {
            if (hoveringHandle) return;
            handle.style.opacity = '0';
            currentBlockPos = null;
          }

          // ── Global mousemove for handle visibility ──

          function onMouseMove(e: MouseEvent) {
            if (destroyed || isDragging) return;
            if (!storage.enabled) {
              if (handle.style.opacity !== '0') {
                handle.style.opacity = '0';
                currentBlockPos = null;
              }
              return;
            }
            if (!view.dom.isConnected) return;

            const editorRect = view.dom.getBoundingClientRect();
            const hitLeft = editorRect.left - 40;

            if (
              e.clientX >= hitLeft &&
              e.clientX <= editorRect.right &&
              e.clientY >= editorRect.top &&
              e.clientY <= editorRect.bottom
            ) {
              const result = findBlockAtY(e.clientY);
              if (result) {
                showHandle(result.dom, result.pos);
              } else if (!hoveringHandle) {
                hideHandle();
              }
            } else if (!hoveringHandle) {
              hideHandle();
            }
          }

          function onScroll() {
            if (!hoveringHandle && !isDragging) hideHandle();
          }

          document.addEventListener('mousemove', onMouseMove);

          const scrollParent = view.dom.closest('.overflow-auto') || view.dom.parentElement;
          if (scrollParent) {
            scrollParent.addEventListener('scroll', onScroll, { passive: true });
          }

          return {
            update() {},
            destroy() {
              destroyed = true;
              document.removeEventListener('mousemove', onMouseMove);
              document.removeEventListener('mousemove', onDragMove);
              document.removeEventListener('mouseup', onDragEnd);
              if (scrollParent) {
                scrollParent.removeEventListener('scroll', onScroll);
              }
              if (handle.parentElement) handle.parentElement.removeChild(handle);
              if (indicator.parentElement) indicator.parentElement.removeChild(indicator);
              document.body.style.cursor = '';
            },
          };
        },
      }),
    ];
  },
});
